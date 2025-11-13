# ========================================
# DATABASE CLEANUP SCRIPT - PowerShell
# ========================================
# Run this script to clean up your database
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DATABASE CLEANUP UTILITY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Database connection details
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_NAME = "Masterlist"
$DB_USER = "postgres"
$DB_PASSWORD = "postgresadmin"

Write-Host "Database: $DB_NAME" -ForegroundColor Yellow
Write-Host "Host: $DB_HOST:$DB_PORT" -ForegroundColor Yellow
Write-Host ""

# Menu
Write-Host "Choose cleanup option:" -ForegroundColor Green
Write-Host "1. Safe Cleanup (Delete farmers only, keep users & barangay codes)" -ForegroundColor White
Write-Host "2. Full Cleanup (Delete ALL data including users)" -ForegroundColor Red
Write-Host "3. Cancel" -ForegroundColor Gray
Write-Host ""

$choice = Read-Host "Enter choice (1-3)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Running SAFE CLEANUP..." -ForegroundColor Green
        Write-Host "This will delete: Farmers, Parcels, History, Transfers" -ForegroundColor Yellow
        Write-Host "This will keep: Users, Barangay Codes" -ForegroundColor Green
        Write-Host ""
        
        $confirm = Read-Host "Are you sure? Type 'YES' to continue"
        
        if ($confirm -eq "YES") {
            $env:PGPASSWORD = $DB_PASSWORD
            psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "database/cleanup_farmer_data_only.sql"
            
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host "⚠️  IMPORTANT: The script ran in SAFE MODE" -ForegroundColor Yellow
            Write-Host "No data was deleted yet (transaction rolled back)" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "To ACTUALLY delete the data:" -ForegroundColor Green
            Write-Host "1. Open: database/cleanup_farmer_data_only.sql" -ForegroundColor White
            Write-Host "2. Find the line: ROLLBACK;" -ForegroundColor White
            Write-Host "3. Comment it out: -- ROLLBACK;" -ForegroundColor White
            Write-Host "4. Uncomment: COMMIT;" -ForegroundColor White
            Write-Host "5. Run this script again" -ForegroundColor White
            Write-Host "========================================" -ForegroundColor Cyan
        } else {
            Write-Host "Cleanup cancelled." -ForegroundColor Gray
        }
    }
    
    "2" {
        Write-Host ""
        Write-Host "⚠️  FULL CLEANUP - DANGER ZONE ⚠️" -ForegroundColor Red
        Write-Host "This will delete EVERYTHING including:" -ForegroundColor Red
        Write-Host "  - All farmer records" -ForegroundColor Red
        Write-Host "  - All user accounts (admin, technician, JO)" -ForegroundColor Red
        Write-Host "  - All parcels and history" -ForegroundColor Red
        Write-Host ""
        
        $confirm = Read-Host "Type 'DELETE EVERYTHING' to continue"
        
        if ($confirm -eq "DELETE EVERYTHING") {
            $env:PGPASSWORD = $DB_PASSWORD
            psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "database/cleanup_all_data.sql"
            
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host "⚠️  IMPORTANT: The script ran in SAFE MODE" -ForegroundColor Yellow
            Write-Host "No data was deleted yet (transaction rolled back)" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "To ACTUALLY delete the data:" -ForegroundColor Green
            Write-Host "1. Open: database/cleanup_all_data.sql" -ForegroundColor White
            Write-Host "2. Find the line: ROLLBACK;" -ForegroundColor White
            Write-Host "3. Comment it out: -- ROLLBACK;" -ForegroundColor White
            Write-Host "4. Uncomment: COMMIT;" -ForegroundColor White
            Write-Host "5. Run this script again" -ForegroundColor White
            Write-Host "========================================" -ForegroundColor Cyan
        } else {
            Write-Host "Cleanup cancelled." -ForegroundColor Gray
        }
    }
    
    "3" {
        Write-Host "Cleanup cancelled." -ForegroundColor Gray
    }
    
    default {
        Write-Host "Invalid choice. Cleanup cancelled." -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
