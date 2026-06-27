/* eslint-disable */
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        let date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}

function getCookie(name) {
    let nameEQ = name + "=";
    let ca = document.cookie.split(';');
    for(let i=0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function sliderToMultiplier(s) {
    s = parseInt(s);
    if (s >= 1) return s;
    if (s <= -1) return 1 / Math.abs(s);
    return 1;
}

function multiplierToSlider(m) {
    m = parseFloat(m) || 1;
    if (m >= 1) {
        return Math.round(m);
    } else {
        return -Math.round(1 / m);
    }
}

function formatMultiplierText(m) {
    if (m >= 1) {
        return m + 'x';
    } else {
        return m.toFixed(2) + 'x';
    }
}

let MapViewModule = {
    sessions: null,
    currentSession: null,
    map: null,
    chart: null,
    updating: false,
    updateInterval: null,
    shareId: null,
    multipliers: {},
    sessionPids: {},
    lastSelectedPids: [],
    init: async function() {
        this.loadCookies();
        if ($('#multiplierPopup').length === 0) {
            $('body').append(`
                <div id="multiplierPopup" class="card shadow p-2" style="position: absolute; display: none; z-index: 10000; width: 220px; border: 1px solid rgba(0,0,0,0.15); background-color: #fff;">
                  <div class="card-body p-2">
                    <h6 class="card-title font-weight-bold mb-2 text-center" style="font-size: 13px; color: var(--primary-color);">Graph Scale</h6>
                    <input type="range" id="popMultiplierSlider" min="-30" max="20" step="1" class="form-control-range w-100">
                    <div class="text-center font-weight-bold mt-1 text-primary" style="font-size: 15px;"><span id="popSliderValue">1x</span></div>
                    <div class="d-flex justify-content-between mt-2">
                      <button id="btnPopCancel" class="btn btn-sm btn-secondary py-1 px-2" style="font-size: 11px;">Cancel</button>
                      <button id="btnPopApply" class="btn btn-sm btn-primary py-1 px-2" style="font-size: 11px;">Apply</button>
                    </div>
                  </div>
                </div>
            `);
        }
        this.shareId = window.location.href.substr(window.location.href.lastIndexOf('/') + 1);
        //get list of user sessions from api
        this.sessions = await Session.getShareSessions(this.shareId);
        // Initialize datatable
        $('#logTable').DataTable({
            "dom": '<f<t><"my-3"i><"my-3"p>>',
            "bLengthChange": false,
            "pageLength": 5,
            responsive: true,
            ajax: {
                url: `/api/sessions/shared/${this.shareId}`,
                dataSrc: function (json) {
                    var return_data = new Array();
                    for(var i=0;i< json.length; i++){
                      return_data.push({
                        'id': json[i].id,
                        'name': json[i].name,
                        'startDate': moment(json[i].startDate).format('DD.MM.YYYY HH:mm:ss'),
                        'endDate': moment(json[i].endDate).format('DD.MM.YYYY HH:mm:ss'),
                        'duration': json[i].duration,
                        'startLocation': json[i].startLocation,
                        'endLocation': json[i].endLocation
                      })
                    }
                    return return_data;
                  }
            },
            columns: [
                { data: 'name' },
                { data: 'startDate' },
                { data: 'endDate' },
                { data: 'duration' },
                { data: 'startLocation' },
                { data: 'endLocation' },
                { data: null },
            ],
            columnDefs: [
                {
                    // put select button in the last column
                    targets: [-1], render: function (data, type, row, meta) {
                        return `<button class="btn btn-primary m-2" onclick="MapViewModule.selectSession(${data.id})">Select</button>`
                    }
            }],
            order: [ 1, "desc" ],
        });
        // Initialize split view
        Split(['#map', '#graph'], {
            direction: 'vertical',
            sizes: [60, 40],
            minSize: [300, 0],
            gutterSize: 10,
            cursor: 'row-resize',
        });
        this.$pidSelectMap = $('#pidSelectMap');
        // Create new Map object in div with id #map
        this.map = new ViewMap('map');
        // Create chart
        this.createChart();
        this.cacheDOM();
        this.bindEvents();
        //activate chosen selects
        this.$chosenSelects.chosen();
        // Select first session
        this.selectSession(this.sessions[this.sessions.length - 1].id);
    },
    cacheDOM: function() {
        this.$loadOverlay = $('#loadOverlay').hide();
        this.$pidSelectMap = $('#pidSelectMap');
        this.$pidSelectChart = $('#pidSelectChart');
        this.$selectSessionModal = $('#selectSessionModal');
        this.$sessionName = $('#sessionName');
        this.$chosenSelects = $(".chosen-select");
        this.$liveIndicator = $('#liveIndicator');
    },
    bindEvents: function() {
        $(document).ajaxStart( this.showLoadOverlay.bind(this) );
        $(document).ajaxStop( this.hideLoadOverlay.bind(this) );
        this.$pidSelectMap.on('change', () => { this.map.drawSession(this.currentSession) });
        this.$pidSelectChart.on('change', this.plotChart.bind(this) );
    },
    toggleUpdateData: function () {
        if(this.updating) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            this.$liveIndicator.toggleClass( "d-none" );
            this.updating = false;
        }
        else {
            this.updateInterval = setInterval(async function() { 
                // Get updated session data
                this.currentSession = await $.get({
                    url: `/api/sessions/shared/${this.shareId}/${this.currentSession.id}`,    
                    global: false
                });
                // Update Map
                this.map.drawSession(this.currentSession);
                // Update Chart
                let timestamps = this.currentSession.Logs.map(log => moment(log.timestamp).format("HH:mm:ss"));
                this.chart.data.labels = timestamps;
                this.plotChart();
            }.bind(this), 5000);
            this.$liveIndicator.toggleClass( "d-none" );
            this.updating = true;
        }
    },
    showLoadOverlay: function() {
        this.$loadOverlay.show();
    },
    hideLoadOverlay: function() {
        this.$loadOverlay.hide();
    },
    selectSession: function(id) {
        this.$selectSessionModal.modal('hide');
        this.currentSession = this.sessions.find(session => session.id == id);
        this.$sessionName.text(this.currentSession.name);
        this.updatePidSelect(this.currentSession);
        this.map.drawSession(this.currentSession);
        let timestamps = this.currentSession.Logs.map(log => moment(log.timestamp).format("HH:mm:ss"));
        if(this.chart) this.chart.destroy();
        this.createChart(timestamps);
        // If session end is less than 60 seconds from now, turn on updating (expect active session)
        if( moment().diff(moment(this.currentSession.endDate), 'seconds') < 60  ) {
            this.toggleUpdateData();
        }
    },
    updatePidSelect: function(session) {
        // remove current values
        this.$pidSelectMap.empty();
        this.$pidSelectChart.empty();
        //get list of available PIDs
        // get all logged values during session (not every log contains every logged value)
        let allValues = new Array;
        session.Logs.forEach(log => {
            allValues.push(Object.keys(log.values));
        });
        let valueSet = [...new Set([].concat(...allValues))];
        valueSet.forEach(pid => {
            // Add option
            this.$pidSelectMap.append(`<option >${pid}</option>`)
            this.$pidSelectChart.append(`<option>${pid}</option>`)
            
        });
        // select Speed (OBD) by default, or fallback to first option
        if (valueSet.includes("Speed (OBD)")) {
            this.$pidSelectMap.val("Speed (OBD)");
        } else {
            this.$pidSelectMap[0].selectedIndex = 0;
        }

        // load and select PIDs from cookies for the chart
        this.loadCookies();
        let selected = this.sessionPids[session.id];
        if (!selected || selected.length === 0) {
            if (this.lastSelectedPids && this.lastSelectedPids.length > 0) {
                selected = this.lastSelectedPids.filter(pid => valueSet.includes(pid));
            }
        }
        if (selected && selected.length > 0) {
            this.$pidSelectChart.val(selected);
        }

        // refresh select
        this.$chosenSelects.trigger("chosen:updated");
        this.drawChosenMultipliers();
        this.plotChart();
    },
    createChart: function(timestamps) {
        // initial data
        let data = {
            labels: timestamps,
            datasets: []
        };
        // Chart options
        let options = {
            maintainAspectRatio: false,
            tooltips: {
                mode: 'index',
                intersect: false,
                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--primary-color'),
                xPadding: 10,
                yPadding: 10,
                position: 'nearest',
                callbacks: {
                    label: function(tooltipItem, data) {
                        let datasetLabel = data.datasets[tooltipItem.datasetIndex].label || '';
                        let value = tooltipItem.yLabel;
                        
                        let self = MapViewModule;
                        let m = self.multipliers[datasetLabel] || 1;
                        let valFloat = parseFloat(value);
                        if (!isNaN(valFloat)) {
                            let originalValue = (valFloat / m).toFixed(2);
                            if (originalValue.endsWith('.00')) {
                                originalValue = originalValue.slice(0, -3);
                            }
                            return datasetLabel + ': ' + originalValue;
                        }
                        return datasetLabel + ': ' + value;
                    }
                }
            },
            hover: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                colorschemes: {
                    scheme: 'tableau.Classic10'
                }
            },
            scales: {
                yAxes: [{
                    // stacked: true,
                    gridLines: {
                        display: true,
                        color: "rgba(50,50,50,0.1)"
                    },
                    callbacks: {
                        color: "rgb(255,0,0)"
                    }
                }],
                xAxes: [{
                    gridLines: {
                        display: true,
                        color: "rgba(200,200,200,0.1)"
                    },
                    ticks: {
                        autoSkip: true,
                        autoSkipPadding: 30
                    }
                }]
            }
        };
        this.chart = Chart.Line('chart', {
            type: 'line',
            options: options,
            data: data
        });
        
        // Extend chart to draw line on hover over x axis
        Chart.plugins.register ( {
            afterDatasetsDraw: function(chart) {
                chart_type = chart.config.type;
                if (chart.tooltip._active && chart.tooltip._active.length && chart_type === 'line') {
                var activePoint = chart.tooltip._active[0],
                ctx = chart.chart.ctx,
                x_axis = chart.scales['x-axis-0'],
                y_axis = chart.scales['y-axis-0'],
                x = activePoint.tooltipPosition().x,
                topY = y_axis.top,
                bottomY = y_axis.bottom;
        
                //label color
                y_axis.fontColor = 'red';
                
                // draw line
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(x, topY+7);
                ctx.lineTo(x, bottomY+1);
                ctx.setLineDash([2,3]);
                ctx.lineWidth = 2;
                ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent-color');
                ctx.stroke();
                ctx.restore();
           }
        }
        });
        
        // Extend chart to open map popup on hover
        Chart.plugins.register({
            afterEvent: function(chart, event) {
              // e.type is the type of the event, translated into an internal touch agnostic type. You can probably use 'mousemove'
                let activePoints = chart.getElementsAtEventForMode(event, 'index', { intersect: false })
                if (activePoints[0]) {
                    let chartData = activePoints[0]['_chart'].config.data;
                    let idx = activePoints[0]['_index'];
        
                    let timestamp = chartData.labels[idx];
        
                    let markers = MapViewModule.map.markerLayer.getLayers();
                    let marker = markers.find(marker => marker.timestamp === timestamp);
        
                    marker.openPopup();
                }
            }
        });
    },
    plotChart: function() {
        // get all selected pids
        let selectedPids = this.$pidSelectChart.val() || [];
        
        //reset curretn chart datasets
        this.chart.data.datasets = []
    
        // Create dataset for each pid
        selectedPids.forEach(pid => {
            let data = new Array;
            let m = this.multipliers[pid] || 1;
            this.currentSession.Logs.forEach(log => {
                let val = parseFloat(log.values[pid]);
                if (!isNaN(val)) {
                    data.push(val * m);
                } else {
                    data.push(null);
                }
            });
            let dataset = {
                label: pid,
                fill: false,
                pointHoverRadius: 5,
                data: data
            };
            this.chart.data.datasets.push( dataset );
        });
        
        this.chart.update({ duration: 0 });
        
        // Redraw chosen multipliers
        this.drawChosenMultipliers();
        
        // Save selected pids to cookies
        if (this.currentSession) {
            this.sessionPids[this.currentSession.id] = selectedPids;
            this.lastSelectedPids = selectedPids;
            setCookie('td_session_pids', JSON.stringify(this.sessionPids), 365);
            setCookie('td_last_selected_pids', JSON.stringify(this.lastSelectedPids), 365);
        }
    },
    loadCookies: function() {
        try {
            this.multipliers = JSON.parse(getCookie('td_multipliers')) || {};
        } catch(e) {
            this.multipliers = {};
        }

        try {
            this.sessionPids = JSON.parse(getCookie('td_session_pids')) || {};
        } catch(e) {
            this.sessionPids = {};
        }

        try {
            this.lastSelectedPids = JSON.parse(getCookie('td_last_selected_pids')) || [];
        } catch(e) {
            this.lastSelectedPids = [];
        }
    },
    drawChosenMultipliers: function() {
        let self = this;
        let chosenContainer = $('#pidSelectChart_chosen');
        
        chosenContainer.find('.search-choice').each(function() {
            let $choice = $(this);
            let textSpan = $choice.find('span');
            let rawText = textSpan.text();
            let pidName = rawText.replace(/\s*\(x[0-9.]+\)$/, '').trim();
            
            let m = self.multipliers[pidName] || 1;
            let displayVal = m < 1 ? m.toFixed(2) : m;
            textSpan.html(`${pidName} <a href="#" class="pid-multiplier-link text-primary font-weight-bold ml-1" data-pid="${pidName}" style="text-decoration: underline;">(x${displayVal})</a>`);
        });

        chosenContainer.find('.pid-multiplier-link').off('click').on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            let $link = $(this);
            let pid = $link.data('pid');
            self.showMultiplierPopup($link, pid);
        });
    },
    showMultiplierPopup: function($link, pid) {
        let self = this;
        let m = self.multipliers[pid] || 1;

        let linkOffset = $link.offset();
        let popup = $('#multiplierPopup');
        
        popup.css({
            display: 'block',
            visibility: 'hidden'
        });
        
        let popupHeight = popup.outerHeight();
        let popupWidth = popup.outerWidth();
        
        let top = linkOffset.top - popupHeight - 8;
        let left = linkOffset.left + ($link.outerWidth() / 2) - (popupWidth / 2);
        
        if (left < 10) left = 10;
        if (top < 10) top = linkOffset.top + $link.outerHeight() + 8;
        
        popup.css({
            top: top + 'px',
            left: left + 'px',
            visibility: 'visible'
        });

        let slider = $('#popMultiplierSlider');
        let valSpan = $('#popSliderValue');
        
        let sliderVal = multiplierToSlider(m);
        slider.val(sliderVal);
        slider.data('prev', sliderVal);
        valSpan.text(formatMultiplierText(m));

        slider.off('input').on('input', function() {
            let val = parseInt($(this).val());
            if (val === 0) {
                let prev = parseInt(slider.data('prev') || 1);
                if (prev > 0) {
                    val = -2;
                } else {
                    val = 1;
                }
                slider.val(val);
            }
            slider.data('prev', val);
            
            let mVal = sliderToMultiplier(val);
            valSpan.text(formatMultiplierText(mVal));
        });

        $('#btnPopCancel').off('click').on('click', function() {
            popup.hide();
        });

        $('#btnPopApply').off('click').on('click', function() {
            let val = parseInt(slider.val());
            let newM = sliderToMultiplier(val);
            self.multipliers[pid] = newM;
            setCookie('td_multipliers', JSON.stringify(self.multipliers), 365);
            popup.hide();
            self.drawChosenMultipliers();
            self.plotChart();
        });

        $(document).off('mousedown.multi').on('mousedown.multi', function(e) {
            if (!popup.is(e.target) && popup.has(e.target).length === 0 && !$link.is(e.target)) {
                popup.hide();
                $(document).off('mousedown.multi');
            }
        });
    }
}
$( document ).ready(function() {
    MapViewModule.init();
});
