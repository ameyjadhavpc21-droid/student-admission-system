# Student Admission & Department Allocation System

## Requirements
- Node.js 18+ installed on your computer.

## Run
1. Open this folder in VS Code.
2. Open Terminal in VS Code.
3. Run:
   npm install
4. Then:
   npm start
5. Open:
   http://localhost:3000

The application automatically creates `data/database.json` and persists all applications, departments and allocations.

## Features
- Student admission form
- Application IDs
- Search and filtering
- Admin approval/rejection
- Department management
- Seat tracking
- Merit + preference + eligibility based automatic allocation
- Reset & re-run allocation
- Dashboard statistics
- CSV report export
- Responsive UI
- No external database setup required

## Allocation rule
Approved students are sorted by percentage from highest to lowest. For each student, the system checks department preferences in order and assigns the first department where:
- the student's percentage meets the department minimum percentage, and
- a seat is available.

## Demo workflow
1. Add students from New Admission.
2. Go to Students and approve applications.
3. Go to Allocation and click Run Allocation.
4. Review the allocation results.
5. Use Export Report to download the final CSV.

## Important for real deployment
This is a functional academic/project system. For production use, add real authentication/authorization, encrypted passwords, server-side validation, audit logs, HTTPS, backups, database transactions, document storage, rate limiting and institution-specific admission rules.
