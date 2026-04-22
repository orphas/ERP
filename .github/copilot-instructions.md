# ERP SGICR - Project Notes

## Tech Stack
- Django 5.2.13, Python 3.11.15, SQLite, Windows
- xhtml2pdf for PDF generation
- Tailwind CSS via CDN, dark glass theme
- venv at `.venv` — activate with `.\.venv\Scripts\activate`

## URL Prefixes
- `/` → ui (homepage)
- `/inventory/` → inventory
- `/clients/` → clients
- `/sales/` → sales (quotes, orders, invoices, deliveries)
- `/purchase/` → procurement (NOT `/procurement/`)
- `/finance/` → finance
- `/hr/` → hr
- `/reports/` → reporting
- `/operations/` → operations
- `/settings/` → settings_app

## Key Patterns
- All forms use FIELD_CSS constant for uniform styling
- Formsets use `initFormset(prefix, containerSelector, addBtnSelector)` from `static/js/formset.js`
- PDF generation via `settings_app/pdf_utils.py` — `render_pdf(template, context, filename, as_attachment)`
- TERMS dict keys use underscores (e.g., `Unit_Price`, `Due_Date`)
- Settings is singleton CompanySettings with pk=1
- PowerShell: use `;` not `&&`; use `python -m pip` not `pip`
