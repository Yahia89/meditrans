import * as XLSX from 'xlsx';

export function exportToExcel(data: any[], filename: string) {
    if (!data || data.length === 0) return;
    
    // Create worksheet from data
    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // Create workbook and append worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    
    // Generate buffer and trigger download
    XLSX.writeFile(workbook, `${filename}.xlsx`);
}
