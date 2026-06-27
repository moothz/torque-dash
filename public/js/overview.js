/* eslint-disable */
let overviewModule = {

    init: async function() {
        this.cacheDOM();
        this.bindEvents();
        this.initLogTable();
    },
    cacheDOM: function() {
        this.$loadOverlay = $('#loadOverlay').hide();
        this.$logTable = $('#logTable');
        this.$importCSVModal = $('#importCSVModal');
        this.$dropZone = $('#dropZone');
        this.$csvFileInput = $('#csvFileInput');
        this.$previewArea = $('#previewArea');
        this.$badgeTime = $('#badgeTime');
        this.$badgeLat = $('#badgeLat');
        this.$badgeLon = $('#badgeLon');
        this.$validationError = $('#validationError');
        this.$validationErrorText = $('#validationErrorText');
        this.$previewHeaderRow = $('#previewHeaderRow');
        this.$previewBody = $('#previewBody');
        this.$previewTotalLines = $('#previewTotalLines');
        this.$btnSubmitImport = $('#btnSubmitImport');
        this.$importSessionName = $('#importSessionName');
    },
    bindEvents: function() {
        $(document).ajaxStart( this.showLoadOverlay.bind(this) );
        $(document).ajaxStop( this.hideLoadOverlay.bind(this) );
        $('#deleteSessionModal').on('show.bs.modal', function (event) {
            let button = $(event.relatedTarget) // Button that triggered the modal
            let id = button.data('id') // Extract info from data-* attributes
            let modal = $(this)
            modal.find('.modal-footer #modalDeleteButton').attr("onclick", "overviewModule.deleteSession('"+id+"')");
        });

        // Drag and drop / file selector events
        this.$dropZone.on('click', () => {
            this.$csvFileInput.click();
        });

        this.$csvFileInput.on('change', (e) => {
            let file = e.target.files[0];
            if (file) this.handleSelectedFile(file);
        });

        this.$dropZone.on('dragover', (e) => {
            e.preventDefault();
            this.$dropZone.addClass('dragover');
        });

        this.$dropZone.on('dragleave', (e) => {
            e.preventDefault();
            this.$dropZone.removeClass('dragover');
        });

        this.$dropZone.on('drop', (e) => {
            e.preventDefault();
            this.$dropZone.removeClass('dragover');
            let file = e.originalEvent.dataTransfer.files[0];
            if (file) this.handleSelectedFile(file);
        });

        this.$btnSubmitImport.on('click', () => {
            this.submitImport();
        });

        this.$importCSVModal.on('hidden.bs.modal', () => {
            this.resetImportModal();
        });
    },
    initLogTable: async function() {
        let table = this.$logTable.DataTable({
            "dom": '<f<t><"my-3"i><"my-3"p>>',
            "bLengthChange": false,
            "pageLength": 5,
            responsive: true,
            ajax: {
                url: '/api/sessions',
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
                    targets: [0], render: function(data, type, row, meta) {
                        return `<a href="/mapview?session=${row.id}" class="text-dark font-weight-bold" title="View on map"><i class="fas fa-eye text-primary mr-2"></i>${data}</a>`;
                    }
                },
                {
                    // puts buttons in the last column
                    targets: [-1], render: function (data, type, row, meta) {
                        return `
                        <div class="dropdown">
                        <button class="btn btn-primary dropdown-toggle" type="button" id="dropdownMenuButton" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                        <i class="fas fa-wrench"></i>
                        </button>
                        <div class="dropdown-menu" aria-labelledby="dropdownMenuButton">
                          <a class="dropdown-item" href="/edit/${data.id}"><i class="fas fa-pen mr-2"></i>Edit</a>
                          <button class="dropdown-item" data-toggle="modal" data-target="#deleteSessionModal" data-id="${data.id}"><i class="fas fa-trash mr-2"></i>Delete</button>
                          <button class="dropdown-item" onclick="overviewModule.exportCSV(${data.id})" data-id="${data.id}"><i class="fas fa-download mr-2"></i>Export CSV</button>
                        </div>
                      </div>
                        `
                    }
                }
            ],
            order: [ 1, "desc" ],
        });

        // Append Import CSV button next to the search field
        let filterContainer = $('#logTable_filter');
        filterContainer.addClass('d-flex align-items-center justify-content-end flex-wrap');
        filterContainer.append('<button id="btnOpenImportModal" class="btn btn-success ml-2" data-toggle="modal" data-target="#importCSVModal"><i class="fas fa-file-import mr-1"></i>Import CSV</button>');
    },
    showLoadOverlay: function() {
        this.$loadOverlay.show();
    },
    hideLoadOverlay: function() {
        this.$loadOverlay.hide();
    },
    deleteSession: async function(id) {
        try{
            await Session.deleteSession(id);
            this.$logTable.DataTable().ajax.reload();
        }
        catch(err) {
            console.log(err);
            Swal.fire({
                type: 'error',
                title: 'Oops...',
                text: 'Something went wrong! Please try again.'
            });
        }
    },
    exportCSV: async function(id) {
        try{
            // Get session
            let session = await Session.getSession(id);
            let exportedFileName = session.name;
            // Create list of all columns
            let columns = ['timestamp','lon','lat'];
            let allValues = new Array;
            session.Logs.forEach(log => {
                allValues.push(Object.keys(log.values));
            });
            let valueSet = [...new Set([].concat(...allValues))];
            valueSet.forEach(value => {
                columns.push(`values.${value}`);
            });
            // Parse json to csv
            const json2csvParser = new json2csv.Parser({  defaultValue: '-', fields: columns });
            const csv = json2csvParser.parse(session.Logs);
            // Download csv
            var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            var link = document.createElement("a");
            var url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `${exportedFileName}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        catch (err) {
            console.log(err);
            Swal.fire({
                type: 'error',
                title: 'Oops...',
                text: 'Something went wrong! Please try again.'
            });
        }
    },
    handleSelectedFile: function(file) {
        if (!file.name.endsWith('.csv')) {
            Swal.fire({
                type: 'error',
                title: 'Invalid file',
                text: 'Please select only CSV files.'
            });
            return;
        }

        let defaultName = file.name.replace(/\.[^/.]+$/, "");
        this.$importSessionName.val(defaultName);

        let reader = new FileReader();
        reader.onload = (e) => {
            this.selectedFileContent = e.target.result;
            this.processFileContentAndPreview(this.selectedFileContent);
        };
        reader.readAsText(file);
    },
    processFileContentAndPreview: function(csvText) {
        let lines = csvText.split(/\r?\n/);
        if (lines.length === 0) {
            this.showValidationError('The file is empty.');
            return;
        }

        let headerRowIdx = -1;
        let headerLine = '';
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() !== '') {
                headerLine = lines[i];
                headerRowIdx = i;
                break;
            }
        }

        if (headerRowIdx === -1) {
            this.showValidationError('Header line not found in the file.');
            return;
        }

        let headers = headerLine.split(',').map(s => s.trim());

        let hasTime = headers.some(h => {
            let hl = h.toLowerCase();
            return hl === 'device time' || hl === 'gps time';
        });
        
        let hasLat = headers.some(h => {
            let hl = h.toLowerCase();
            return hl === 'latitude' || hl === 'gps latitude(°)' || hl === 'gps latitude';
        });
        
        let hasLon = headers.some(h => {
            let hl = h.toLowerCase();
            return hl === 'longitude' || hl === 'gps longitude(°)' || hl === 'gps longitude';
        });

        this.updateBadgeStatus(this.$badgeTime, hasTime);
        this.updateBadgeStatus(this.$badgeLat, hasLat);
        this.updateBadgeStatus(this.$badgeLon, hasLon);

        if (!hasTime || !hasLat || !hasLon) {
            this.$validationErrorText.text('The CSV file must contain time (Device Time or GPS Time), Latitude, and Longitude columns.');
            this.$validationError.show();
            this.$btnSubmitImport.prop('disabled', true);
            this.$previewArea.show();
            return;
        }

        this.$validationError.hide();
        this.$btnSubmitImport.prop('disabled', false);

        this.$previewHeaderRow.empty();
        
        let findColumn = (preferred, fallbacks) => {
            let idx = headers.findIndex(h => h.toLowerCase() === preferred.toLowerCase());
            if (idx !== -1) return idx;
            for (let fb of fallbacks) {
                idx = headers.findIndex(h => h.toLowerCase() === fb.toLowerCase());
                if (idx !== -1) return idx;
            }
            return -1;
        };

        let timeIdx = findColumn('device time', ['gps time']);
        let latIdx = findColumn('latitude', ['gps latitude(°)', 'gps latitude']);
        let lonIdx = findColumn('longitude', ['gps longitude(°)', 'gps longitude']);

        let columnsToShow = [];
        columnsToShow.push({ index: timeIdx, name: headers[timeIdx] });
        columnsToShow.push({ index: latIdx, name: headers[latIdx] });
        columnsToShow.push({ index: lonIdx, name: headers[lonIdx] });

        let extraAdded = 0;
        for (let i = 0; i < headers.length; i++) {
            if (i !== timeIdx && i !== latIdx && i !== lonIdx && extraAdded < 3) {
                columnsToShow.push({ index: i, name: headers[i] });
                extraAdded++;
            }
        }

        columnsToShow.forEach(col => {
            this.$previewHeaderRow.append(`<th class="p-2">${col.name}</th>`);
        });

        this.$previewBody.empty();
        let previewCount = 0;
        let totalCount = 0;
        
        for (let i = headerRowIdx + 1; i < lines.length; i++) {
            let line = lines[i].trim();
            if (line === '') continue;
            
            if (line.toLowerCase().startsWith('gps time') || line.toLowerCase().startsWith('device time')) {
                continue;
            }
            
            totalCount++;
            
            if (previewCount < 5) {
                let rowValues = line.split(',').map(s => s.trim());
                let tr = $('<tr></tr>');
                
                columnsToShow.forEach(col => {
                    let cellVal = rowValues[col.index] !== undefined ? rowValues[col.index] : '';
                    tr.append(`<td class="p-2">${cellVal}</td>`);
                });
                
                this.$previewBody.append(tr);
                previewCount++;
            }
        }

        this.$previewTotalLines.html(`<i class="fas fa-info-circle mr-1"></i> Total records found: <strong>${totalCount}</strong>`);
        this.$previewArea.show();
    },
    updateBadgeStatus: function($badge, isValid) {
        if (isValid) {
            $badge.removeClass('badge-secondary badge-danger').addClass('badge-success');
            $badge.find('i').removeClass('fa-times').addClass('fa-check');
        } else {
            $badge.removeClass('badge-secondary badge-success').addClass('badge-danger');
            $badge.find('i').removeClass('fa-check').addClass('fa-times');
        }
    },
    showValidationError: function(msg) {
        this.$validationErrorText.text(msg);
        this.$validationError.show();
        this.$previewArea.hide();
        this.$btnSubmitImport.prop('disabled', true);
    },
    resetImportModal: function() {
        this.$csvFileInput.val('');
        this.$importSessionName.val('');
        this.selectedFileContent = null;
        this.$previewArea.hide();
        this.$validationError.hide();
        this.$btnSubmitImport.prop('disabled', true);
        this.$badgeTime.removeClass('badge-success badge-danger').addClass('badge-secondary').find('i').removeClass('fa-check').addClass('fa-times');
        this.$badgeLat.removeClass('badge-success badge-danger').addClass('badge-secondary').find('i').removeClass('fa-check').addClass('fa-times');
        this.$badgeLon.removeClass('badge-success badge-danger').addClass('badge-secondary').find('i').removeClass('fa-check').addClass('fa-times');
    },
    submitImport: async function() {
        let name = this.$importSessionName.val().trim();
        if (!name) {
            Swal.fire({
                type: 'error',
                title: 'Session Name Required',
                text: 'Please enter a session name.'
            });
            return;
        }

        if (!this.selectedFileContent) {
            Swal.fire({
                type: 'error',
                title: 'Missing File',
                text: 'Please select a file first.'
            });
            return;
        }

        try {
            this.showLoadOverlay();
            this.$importCSVModal.modal('hide');

            await $.ajax({
                type: 'POST',
                url: '/api/sessions/import',
                data: JSON.stringify({
                    name: name,
                    csv: this.selectedFileContent
                }),
                contentType: 'application/json; charset=utf-8'
            });

            this.hideLoadOverlay();
            Swal.fire({
                type: 'success',
                title: 'Imported!',
                text: 'Your session has been successfully imported.',
                timer: 2000
            });

            this.$logTable.DataTable().ajax.reload();
        } catch(err) {
            this.hideLoadOverlay();
            console.log(err);
            let errorMsg = 'An error occurred while importing the CSV file.';
            if (err.responseText) {
                errorMsg = err.responseText;
            }
            Swal.fire({
                type: 'error',
                title: 'Import Error',
                text: errorMsg
            });
        }
    }
}

overviewModule.init();
    
    
    






