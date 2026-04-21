# BSOM Intake API

Node.js / Express REST API powering the Behavioral Solutions of Mississippi Intake Operations Portal.

## Features
- Referrals API (intake tracking)
- Assessments API (clinical workflow)
- Activity Logs (audit trail)
- Relational data model (referral → assessment)

## Tech Stack
- Node.js
- Express
- PostgreSQL (AWS RDS)
- pg (node-postgres)

## Endpoints
- GET /referrals
- GET /referrals/:id
- GET /assessments
- GET /assessments/:id
- GET /activity-logs
- GET /activity-logs/:id
- GET /referrals/:id/activity

## Notes
Built to support a HIPAA-aligned intake workflow system for ABA services.
