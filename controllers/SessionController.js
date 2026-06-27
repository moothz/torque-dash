const Session = require('../models').Session;
const Log = require('../models').Log;
const User = require('../models').User;
const sequelize = require('../models').sequelize;
const Op = require('../models').Sequelize.Op;
const moment = require('moment');
require('moment-duration-format');
const shortid = require('shortid');
const pidNames = require('../torquekeys.json');

class SessionController {
    static async delete(req, res) {
        try{
            let userId = req.user.id;
            let sessionId = req.params.sessionId
            let session = await Session.destroy({ where: {id: sessionId, userId: userId } });
            if(!session) return res.status(401).send('Session not found');
            res.sendStatus(200);
        }
        catch (err) {
            console.log(err);
            res.sendStatus(500);
        }
    }
    static async getOne(req, res) {
        try{
            // Get session for user
            let session = await Session.findOne({
                where: { 
                    userId: req.user.id ,
                    id: req.params.sessionId
                },
                include: [ { model: Log, as: 'Logs' } ],
                order: [[ {model: Log, as: 'Logs'}, 'timestamp', 'ASC' ]]
            });
            if(!session) return res.status(404).send('Resource not found');
            await addStartEndData(session)
            res.send(session);
        }
        catch (err) {
            console.log(err);
            res.sendStatus(500);
        }
    }
    static async getAll(req, res) {
        try {
            // Check if user exists
            let user = await User.findOne({
                where: { id: req.user.id }
            });
            if(!user) return res.status(401);

            // Get all sessions for user
            let sessions = await Session.findAll({
                where: { userId: user.id },
                // Include array of logs from session
                include: [ { model: Log, as: 'Logs' } ],
                order: [[ {model: Log, as: 'Logs'}, 'timestamp', 'ASC' ]]
            });
            await addStartEndData(sessions);
            res.send(sessions);
        }
        catch (err) {
            console.log(err);
            res.sendStatus(500);
        }
    }
    static async getOneShared(req, res) {
        try{
            // Check if user exists
            let user = await User.findOne({
                where: { shareId: req.params.shareId }
            });
            if(!user) return res.sendStatus(404);

            // Get session for user
            let session = await Session.findOne({
                where: { 
                    userId: user.id,
                    id: req.params.sessionId
                },
                // Include array of logs from session
                include: [ { model: Log, as: 'Logs' } ],
                order: [[ {model: Log, as: 'Logs'}, 'timestamp', 'ASC' ]]
            });
            await addStartEndData(session);
            res.send(session);
        }
        catch (err) {
            console.log(err);
            res.sendStatus(500);
        }
    }
    static async getAllShared(req, res) {
        try {
            // Check if user exists
            let user = await User.findOne({
                where: { shareId: req.params.shareId }
            });
            if(!user) return res.sendStatus(404);

            // Get all sessions for user
            let sessions = await Session.findAll({
                where: { userId: user.id },
                // Include array of logs from session
                include: [ { model: Log, as: 'Logs' } ],
                order: [[ {model: Log, as: 'Logs'}, 'timestamp', 'ASC' ]]
            });
            await addStartEndData(sessions);
            res.send(sessions);
        }
        catch (err) {
            console.log(err);
            res.sendStatus(500);
        }
    }
    static async rename(req, res) {
        try {
            await Session.update(
                { name: req.body.name },
                { where: { 
                    id: req.params.sessionId, 
                    userId: req.user.id 
                    } 
                }
            )
            res.sendStatus(200);
        }
        catch (err) {
            console.log(err);
            res.sendStatus(500);
        }
    }
    static async addLocation(req, res) {
        try {
            await Session.update(
                { startLocation: req.body.locations.start,
                  endLocation: req.body.locations.end },
                { where: { 
                    id: req.params.sessionId, 
                    userId: req.user.id 
                    } 
                }
            )
            res.sendStatus(200);
        }
        catch (err) {
            console.log(err);
            res.sendStatus(500);
        }
    }
    static async copy(req, res) {
        try {
            await sequelize.transaction( async (t) => {
                // find the session
                let session = await Session.findOne({
                    where: { 
                        userId: req.user.id,
                        id: req.params.sessionId
                        },
                        include: {all:true}
                });
                // Create a copy of the session
                let sessionCopy = await Session.create({
                    sessionId: shortid.generate(),
                    name: req.body.name,
                    startLocation: session.startLocation,
                    endLocation: session.endLocation,
                    userId: session.userId
                });
                // Create copy for each session log
                await Promise.all(session.Logs.map(async log => {
                    try{
                        await Log.create({
                            sessionId: sessionCopy.id,
                            timestamp: log.dataValues.timestamp,
                            lon: log.dataValues.lon,
                            lat: log.dataValues.lat,
                            values: log.dataValues.values
                        });
                    }
                    catch (err) {
                        console.log(err);
                        res.sendStatus(500);
                    }
                  }));
            });
            res.sendStatus(200);
        }
        catch (err) {
            console.log(err);
            res.sendStatus(500);
        }
    }
    static async filter(req, res) {
        try {
            let filterNumber = parseInt(req.body.filterNumber);
            let session = await Session.findOne({ 
                where: { 
                    id: req.params.sessionId, 
                    userId: req.user.id 
                }
            });
            if(!session) return res.sendStatus(404);
            // get session logs
            let logs = await session.getLogs({raw:true});
            if(filterNumber > logs.length) return res.sendStatus(200);
            
            // get list of log ids to be filtered
            let logsToBeFiltered = [];
            for (let i = filterNumber - 1; i < logs.length; i += filterNumber) {
                logsToBeFiltered.push(logs[i].id);
            }
            // delete logs
            await Log.destroy({ where: {
                sessionId: session.id,
                id: { [Op.notIn]: logsToBeFiltered}
            }});
            res.sendStatus(200);
        }
        catch (err) {
            console.log(err);
            res.sendStatus(500);
        }
    }
    static async cut(req, res) {
        try {
            let { from, to } = req.body
            let session = await Session.findOne({ 
                where: { 
                    id: req.params.sessionId, 
                    userId: req.user.id 
                }
            });
            if(!session) return res.sendStatus(404);
            
            // delete logs
            await Log.destroy({ where: {
                sessionId: session.id,
                timestamp: {
                    [Op.and]: {
                        [Op.gte]: from,
                        [Op.lte]: to
                      }
                }
            }});
            res.sendStatus(200);
        }
        catch (err) {
            console.log(err);
            res.sendStatus(500);
        }
    }
    static async join(req, res) {
        try {
            let { joinSessionId, name } = req.body
            let sessionOne = await Session.findOne({ 
                where: { 
                    id: req.params.sessionId, 
                    userId: req.user.id
                },
                include: {all:true}
            });
            let sessionTwo = await Session.findOne({
                where: { 
                    id: joinSessionId, 
                    userId: req.user.id
                },
                include: {all:true}
            })
            if(!sessionOne || !sessionTwo) return res.sendStatus(404); 

            await sequelize.transaction( async (t) => {
                // create new session
                let joinSession = await Session.create({
                    sessionId: shortid.generate(),
                    name: name,
                    userId: req.user.id
                });
                // Create new joined logs
                await Promise.all(sessionOne.Logs.map(async log => {
                    try{
                        await Log.create({
                            sessionId: joinSession.id,
                            timestamp: log.dataValues.timestamp,
                            lon: log.dataValues.lon,
                            lat: log.dataValues.lat,
                            values: log.dataValues.values
                        });
                    }
                    catch (err) {
                        console.log(err);
                        res.sendStatus(500);
                    }
                }));
                await Promise.all(sessionTwo.Logs.map(async log => {
                    try{
                        await Log.create({
                            sessionId: joinSession.id,
                            timestamp: log.dataValues.timestamp,
                            lon: log.dataValues.lon,
                            lat: log.dataValues.lat,
                            values: log.dataValues.values
                        });
                    }
                    catch (err) {
                        console.log(err);
                        res.sendStatus(500);
                    }
                }));
            });
            res.sendStatus(200);
        }
        catch (err) {
            console.log(err);
            res.sendStatus(500);
        }
    }
    static async importCSV(req, res) {
        try {
            const { name, csv } = req.body;
            if (!name || !csv) {
                return res.status(400).send('Name and CSV content are required.');
            }

            const pidInverseMap = {};
            for (const [key, valName] of Object.entries(pidNames)) {
                pidInverseMap[valName.toLowerCase()] = key;
            }

            function getPidKey(header) {
                const cleanHeader = header.trim();
                const cleanHeaderLower = cleanHeader.toLowerCase();
                
                if (pidInverseMap[cleanHeaderLower]) {
                    return pidInverseMap[cleanHeaderLower];
                }
                
                const stripped = cleanHeader.replace(/\([^)]*\)$/, '').trim().toLowerCase();
                if (pidInverseMap[stripped]) {
                    return pidInverseMap[stripped];
                }
                
                return null;
            }

            // Split by carriage return or newline
            const lines = csv.split(/\r?\n/);
            if (lines.length === 0) {
                return res.status(400).send('CSV content is empty.');
            }
            
            // Find the header line (first non-empty line)
            let headerLine = "";
            let headerIndex = 0;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim() !== "") {
                    headerLine = lines[i];
                    headerIndex = i;
                    break;
                }
            }
            
            if (!headerLine) {
                return res.status(400).send('CSV header not found.');
            }
            
            const parseCSVLine = (line) => {
                return line.split(',').map(s => s.trim());
            };
            
            const headers = parseCSVLine(headerLine);
            
            // Map header indexes
            let timeColIdx = -1;
            let latColIdx = -1;
            let lonColIdx = -1;
            const pidCols = [];
            
            for (let i = 0; i < headers.length; i++) {
                const header = headers[i];
                const headerLower = header.toLowerCase();
                
                if (headerLower === 'device time') {
                    timeColIdx = i;
                } else if (headerLower === 'gps time') {
                    if (timeColIdx === -1) timeColIdx = i;
                } else if (headerLower === 'latitude') {
                    latColIdx = i;
                } else if (headerLower === 'gps latitude(°)' || headerLower === 'gps latitude') {
                    if (latColIdx === -1) latColIdx = i;
                } else if (headerLower === 'longitude') {
                    lonColIdx = i;
                } else if (headerLower === 'gps longitude(°)' || headerLower === 'gps longitude') {
                    if (lonColIdx === -1) lonColIdx = i;
                } else {
                    const pidKey = getPidKey(header);
                    if (pidKey) {
                        if (pidKey === 'kff1005') {
                            if (lonColIdx === -1) lonColIdx = i;
                        } else if (pidKey === 'kff1006') {
                            if (latColIdx === -1) latColIdx = i;
                        } else {
                            pidCols.push({ index: i, pidKey });
                        }
                    }
                }
            }
            
            if (timeColIdx === -1 || latColIdx === -1 || lonColIdx === -1) {
                return res.status(400).send('CSV missing required columns: Time, Latitude or Longitude.');
            }
            
            const logsData = [];
            const seenTimestamps = new Set();
            
            for (let i = headerIndex + 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line === "") continue;
                
                // Skip header repetitions
                if (line.toLowerCase().startsWith('gps time') || line.toLowerCase().startsWith('device time')) {
                    continue;
                }
                
                const row = parseCSVLine(line);
                if (row.length < headers.length) continue;
                
                const timeVal = row[timeColIdx];
                const latVal = parseFloat(row[latColIdx]);
                const lonVal = parseFloat(row[lonColIdx]);
                
                if (isNaN(latVal) || isNaN(lonVal)) continue;
                
                let dateVal = moment(timeVal, 'DD-MMM-YYYY HH:mm:ss.SSS');
                if (!dateVal.isValid()) {
                    dateVal = moment(timeVal, 'ddd MMM DD HH:mm:ss [GMT]Z YYYY');
                }
                if (!dateVal.isValid()) {
                    dateVal = moment(timeVal);
                }
                
                if (!dateVal.isValid()) continue;
                
                const timestamp = dateVal.format('YYYY-MM-DD HH:mm:ss');
                
                if (seenTimestamps.has(timestamp)) {
                    continue;
                }
                seenTimestamps.add(timestamp);
                
                const values = {};
                for (const col of pidCols) {
                    const val = row[col.index];
                    if (val !== undefined && val !== null && val !== "" && val !== "-") {
                        values[col.pidKey] = val;
                    }
                }
                
                logsData.push({
                    timestamp,
                    lat: latVal,
                    lon: lonVal,
                    values
                });
            }

            if (logsData.length === 0) {
                return res.status(400).send('No valid log records found in CSV.');
            }

            // Create session and logs in transaction
            await sequelize.transaction(async (t) => {
                const sessionRecord = await Session.create({
                    sessionId: shortid.generate(),
                    name: name,
                    userId: req.user.id
                }, { transaction: t });

                // Map sessionId to logs
                const logsWithSession = logsData.map(log => ({
                    ...log,
                    sessionId: sessionRecord.id
                }));

                await Log.bulkCreate(logsWithSession, { transaction: t });
            });

            res.sendStatus(200);
        } catch (err) {
            console.log(err);
            res.sendStatus(500);
        }
    }
}

async function addStartEndData(sessions) {
    if(Array.isArray(sessions)){
        for (const session of sessions) {
            const firstLog = await Log.findAll({
                limit: 1,
                where: {
                    sessionId: session.id
                },
                order: [ [ 'timestamp', 'ASC' ]]
                });
            const lastLog = await Log.findAll({
                limit: 1,
                where: {
                    sessionId: session.id
                },
                order: [ [ 'timestamp', 'DESC' ]],
            });
            let duration = moment.duration(lastLog[0].timestamp - firstLog[0].timestamp);
    
            session.dataValues.startDate = firstLog[0].timestamp;
            session.dataValues.endDate = lastLog[0].timestamp;
            session.dataValues.duration = duration.format('D [day] HH [hour] mm [minute] ss [second]');
        }
    }
    else {
        const firstLog = await Log.findAll({
            limit: 1,
            where: {
                sessionId: sessions.id
            },
            order: [ [ 'timestamp', 'ASC' ]]
            });
        const lastLog = await Log.findAll({
            limit: 1,
            where: {
                sessionId: sessions.id
            },
            order: [ [ 'timestamp', 'DESC' ]],
        });
        let duration = moment.duration(lastLog[0].timestamp - firstLog[0].timestamp);

        sessions.dataValues.startDate = firstLog[0].timestamp;
        sessions.dataValues.endDate = lastLog[0].timestamp;
        sessions.dataValues.duration = duration.format('D [day] HH [hour] mm [minute] ss [second]');
    }
}

module.exports = SessionController;