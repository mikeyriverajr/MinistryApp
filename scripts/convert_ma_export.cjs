const fs = require('fs');

function dmsToDecimal(degrees, minutes, seconds, direction) {
    let decimal = parseInt(degrees) + parseInt(minutes)/60 + parseFloat(seconds)/3600;
    if (direction === 'S' || direction === 'W') {
        decimal = decimal * -1;
    }
    return decimal;
}

function parseInputFile(filePath) {
    const text = fs.readFileSync(filePath, 'utf8');
    const records = text.split(/-------------------------------------------------------------------------/).map(s => s.trim()).filter(s => s.length > 0);

    const visits = [];
    let idCounter = 1;

    for (const record of records) {
        const lines = record.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        let latitude = null;
        let longitude = null;
        let name = "Unknown";
        let dateFound = new Date().getTime();
        let notes = [];
        let dates = [];

        // Match coordinates. A pattern might look like "07031227° 19' 34.93"S, 55° 52' 1.78"W"
        // We only care about the last 2 digits before the degree symbol for South America.
        // More generally, let's just grab the part matching "(\d+)° (\d+)' ([\d.]+)"([NS])" but allow trailing characters
        // No wait, if we see 07031227, the degrees is 27. So let's match `(\d{1,3})°` and ensure the full match has boundary or prefix, but we only want the actual degree. Wait, the actual number is 27.
        // Let's use `(\d+)°` and if it's > 180, we take the last 2 digits as degrees.

        const dmsRegex = /(\d+)° (\d+)' ([\d.]+)"([NS]), (\d+)° (\d+)' ([\d.]+)"([EW])/;
        const mapsRegex = /https:\/\/maps\.app\.goo\.gl\/[a-zA-Z0-9]+/;
        const dateRegex = /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/; // e.g., Aug 14, 2025

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Match coordinates
            const coordMatch = line.match(dmsRegex);
            if (coordMatch) {
                let deg1 = coordMatch[1];
                if (deg1.length > 3) deg1 = deg1.slice(-2);

                let deg2 = coordMatch[5];
                if (deg2.length > 3) deg2 = deg2.slice(-2);

                latitude = dmsToDecimal(deg1, coordMatch[2], coordMatch[3], coordMatch[4]);
                longitude = dmsToDecimal(deg2, coordMatch[6], coordMatch[7], coordMatch[8]);
                continue;
            }

            // Just drop maps urls or add to notes
            if (line.match(mapsRegex)) {
                notes.push(line);
                continue;
            }

            // Match dates
            if (line.match(dateRegex)) {
                dates.push(new Date(line).getTime());
                continue;
            }

            // The first line that isn't a coordinate, date, or map url we try to parse as name.
            if (name === "Unknown") {
                // Ignore Plus codes
                if (line.match(/^[A-Z\d\+]+$/) || line.match(/^[A-Z] [A-Z0-9\+]+$/)) {
                    notes.push(line);
                    continue;
                }

                name = line;
                continue;
            }

            // Any other lines just go into notes
            notes.push(line);
        }

        // We use the earliest date as dateFound
        if (dates.length > 0) {
            dates.sort((a,b) => a - b);
            dateFound = dates[0];
        }

        const visit = {
            id: idCounter++,
            name: name,
            dateFound: dateFound,
            latitude: latitude,
            longitude: longitude,
            houseDescription: "",
            generalNotes: notes.join('\n'),
            nextVisitDate: null,
            interestLevel: "Medio",
            isRecurringStudy: false,
            recurringStudyDayOfWeek: null,
            recurringStudyTime: null,
            followUpVisits: [],
            createdAt: dateFound,
            updatedAt: dateFound
        };

        // Add follow up visits for other dates
        if (dates.length > 1) {
            for (let i = 1; i < dates.length; i++) {
                visit.followUpVisits.push({
                    id: String(new Date().getTime() + i),
                    date: dates[i],
                    notes: ""
                });
            }
        }

        visits.push(visit);
    }
    return visits;
}


function generateDexieImport(visits) {
    const importFormat = {
        formatName: "dexie",
        formatVersion: 1,
        data: {
            databaseName: "MinistryDB",
            databaseVersion: 2,
            tables: [
                {
                    name: "userProfile",
                    schema: "++id,name",
                    rowCount: 0
                },
                {
                    name: "visits",
                    schema: "++id,name,dateFound,nextVisitDate,interestLevel,isRecurringStudy",
                    rowCount: visits.length
                }
            ],
            data: [
                {
                    tableName: "userProfile",
                    inbound: true,
                    rows: []
                },
                {
                    tableName: "visits",
                    inbound: true,
                    rows: visits.map(v => {
                        const types = {
                            dateFound: "date",
                            createdAt: "date",
                            updatedAt: "date"
                        };

                        if (v.followUpVisits && v.followUpVisits.length > 0) {
                             types.followUpVisits = "arrayNonindexKeys";
                             v.followUpVisits.forEach((fv, i) => {
                                 types[`followUpVisits.${i}.date`] = "date";
                             });
                        }

                        return {
                            ...v,
                            $types: types
                        };
                    })
                }
            ]
        }
    };
    return importFormat;
}

const visits = parseInputFile('scripts/sample_input.txt');
const dexieJson = generateDexieImport(visits);

fs.writeFileSync('scripts/import_ready.json', JSON.stringify(dexieJson, null, 2));
console.log(`Generated import_ready.json with ${visits.length} records.`);
