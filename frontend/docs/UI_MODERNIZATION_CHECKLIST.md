# Salehish authenticated UI modernization checklist

## Shared foundation

- [x] Main authenticated canvas, ambient lighting, responsive background treatment, elevation tokens, and reduced-motion behavior.
- [x] Shared dashboard and workspace surfaces, forms, tables, buttons, modal, confirmation dialog, and toast presentation.
- [x] Existing bottom navigation structure, routes, role visibility, and navigation behavior preserved.

## High-expression workspaces

- [x] Owner dashboard: salon session, completed-service bento metrics, action groups, appointment/section/service summaries.
- [x] Statistics & Analytics: glass filter panel, elevated KPI/chart surfaces, bento hierarchy, chart framing.
- [x] Employee Finance: financial hero, KPI card treatment, transaction/form surfaces.
- [x] Employee Profile: profile presentation, tabs, details, finance, receipt, and audit surfaces.

## Shared workspace coverage

The following mounted pages inherit the authenticated canvas, surface, table, form, interaction, responsive, and accessibility treatments through their existing shared classes and elements. Their data contracts and actions were not changed.

- [x] Owner: appointments, salon setup, employees, advances, reports, staff performance, goals/campaigns, and fee reports.
- [x] Manager: dashboard, employees, employee finance, statistics, and staff performance.
- [x] Cashier: dashboard, staff payments, employee profile, and income review.
- [x] Employee: dashboard, personal finance, income, and profile.
- [x] Customer: dashboard, appointments, service history, and settings.

## Verification status

- [x] Production frontend build.
- [x] Scoped lint for changed components (one existing Owner Dashboard hook dependency warning remains).
- [ ] Browser interaction testing at desktop, tablet, and mobile widths. The local browser automation surface was unavailable during this pass, so this remains an explicit manual verification item.
- [ ] Role-by-role interaction review after the local browser is available: session controls, quick actions, finance forms, signatures, appointment actions, tables, dialogs, and exports.
