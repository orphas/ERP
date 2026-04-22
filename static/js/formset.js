/**
 * Dynamic Django inline formset manager.
 * Usage: initFormset('items', '#items-body', '#add-item-btn')
 */
function initFormset(prefix, containerSelector, addBtnSelector) {
    const container = document.querySelector(containerSelector);
    const addBtn = document.querySelector(addBtnSelector);
    const totalForms = document.querySelector(`#id_${prefix}-TOTAL_FORMS`);

    if (!container || !addBtn || !totalForms) return;

    addBtn.addEventListener('click', function () {
        const formCount = parseInt(totalForms.value);
        // Get the empty form template
        const emptyRow = container.querySelector('.formset-row:last-child');
        if (!emptyRow) return;

        const newRow = emptyRow.cloneNode(true);
        // Update all input/select names and ids
        newRow.querySelectorAll('input, select, textarea').forEach(function (el) {
            if (el.name) {
                el.name = el.name.replace(/-\d+-/, `-${formCount}-`);
            }
            if (el.id) {
                el.id = el.id.replace(/-\d+-/, `-${formCount}-`);
            }
            // Clear values except for hidden fields and checkboxes
            if (el.type === 'hidden' && el.name.endsWith('-id')) {
                el.value = '';
            } else if (el.type === 'checkbox') {
                el.checked = false;
            } else if (el.type !== 'hidden') {
                el.value = '';
            }
        });
        newRow.querySelectorAll('label').forEach(function (el) {
            if (el.htmlFor) {
                el.htmlFor = el.htmlFor.replace(/-\d+-/, `-${formCount}-`);
            }
        });
        // Make sure the row is visible
        newRow.style.display = '';
        newRow.classList.remove('hidden');
        container.appendChild(newRow);
        totalForms.value = formCount + 1;
    });

    // Delegate delete button clicks
    container.addEventListener('click', function (e) {
        const deleteBtn = e.target.closest('.delete-row-btn');
        if (!deleteBtn) return;
        const row = deleteBtn.closest('.formset-row');
        if (!row) return;
        // If the row has an id field with a value, mark DELETE checkbox
        const deleteCheckbox = row.querySelector('input[name$="-DELETE"]');
        if (deleteCheckbox) {
            deleteCheckbox.checked = true;
            row.style.display = 'none';
        } else {
            // Remove the row entirely (new unsaved row)
            row.remove();
            // Reindex forms
            reindexForms(prefix, container, totalForms);
        }
    });
}

function reindexForms(prefix, container, totalForms) {
    const rows = container.querySelectorAll('.formset-row');
    rows.forEach(function (row, idx) {
        row.querySelectorAll('input, select, textarea').forEach(function (el) {
            if (el.name) {
                el.name = el.name.replace(new RegExp(`${prefix}-\\d+-`), `${prefix}-${idx}-`);
            }
            if (el.id) {
                el.id = el.id.replace(new RegExp(`${prefix}-\\d+-`), `${prefix}-${idx}-`);
            }
        });
    });
    totalForms.value = rows.length;
}
