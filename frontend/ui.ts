import {api} from '../api.js'

async function main() {
    const app = document.createElement('div');
    const windows = await api.getWindows()
    // create a table of windows
    const tbl = document.createElement('table');
    tbl.classList.add('table');
    const header = tbl.createTHead();
    const row = header.insertRow(0);
    const cell1 = row.insertCell(0);
    const cell2 = row.insertCell(1);
    cell1.innerHTML = "<b>Title</b>";
    cell2.innerHTML = "<b>Class Name</b>";
    for (const w of windows) {
        const row = tbl.insertRow(-1);
        const cell1 = row.insertCell(0);
        const cell2 = row.insertCell(1);
        cell1.innerHTML = w.title;
        cell2.innerHTML = w.className;
    }
    app.appendChild(tbl);
    document.body.appendChild(app);
}

document.addEventListener('DOMContentLoaded', function() {
    main();
}, false);

