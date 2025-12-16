import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Papa from 'https://esm.sh/papaparse@5.4.1'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { upload_id } = await req.json()

    if (!upload_id) {
      throw new Error('Missing upload_id')
    }

    // 1. Get Upload Details
    const { data: upload, error: fetchError } = await supabase
      .from('org_uploads')
      .select('*')
      .eq('id', upload_id)
      .single()

    if (fetchError || !upload) throw new Error('Upload record not found')

    // Update status to processing
    await supabase.from('org_uploads').update({ status: 'processing' }).eq('id', upload_id)

    // 2. Download File
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(upload.file_path)

    if (downloadError) throw downloadError

    // 3. Determine File Type & Parse
    let rawRows: any[][] = []
    const fileExt = upload.original_filename?.split('.').pop()?.toLowerCase()
    
    // Helper to normalize keys (strips special chars, lowercases)
    const normalizeKey = (key: string) => (key || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '_')
    
    // Known columns to look for when detecting header row
    const KNOWN_HEADERS = [
        'name', 'fullname', 'full_name', 'first_name', 'last_name',
        'email', 'email_address',
        'phone', 'mobile', 'cell', 'contact', 'phone_number',
        'address', 'street', 'city', 'state', 'zip',
        'license', 'license_number', 'dl',
        'dob', 'date_of_birth', 'birth_date',
        'vehicle', 'make', 'model', 'notes', 'note'
    ]

    if (['xlsx', 'xls'].includes(fileExt)) {
        // Handle Excel
        const arrayBuffer = await fileData.arrayBuffer()
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
        
        let sheetName = ''
        const sourceName = upload.source?.toLowerCase()
        
        // Try to find sheet by name
        const matchingSheet = workbook.SheetNames.find(n => n.toLowerCase().includes(sourceName))
        sheetName = matchingSheet || workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        // Get as array of arrays (header: 1)
        rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
        
    } else if (fileExt === 'pdf') {
        // ... (PDF Logic)
        console.warn('PDF parsing not yet implemented on Edge. Skipping auto-extraction.')
        await supabase.from('org_uploads').update({ 
            status: 'ready_for_review',
            notes: 'PDF uploaded. Automatic parsing is currently limited. Please review manually.'
        }).eq('id', upload_id)
        
        return new Response(
            JSON.stringify({ success: true, rows_processed: 0, message: 'PDF stored (parsing skipped)' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } else {
        // Default to CSV / Text
        const text = await fileData.text()
        const parseResult = Papa.parse(text, {
            header: false, // Read as arrays to find header manually
            skipEmptyLines: true,
        })
        if (parseResult.errors.length > 0) {
            console.error('CSV Parse Errors', parseResult.errors)
        }
        rawRows = parseResult.data as any[][]
    }
    
    // 3b. Smart Header Detection
    // Scan first 10 rows to find the one with the most matches to KNOWN_HEADERS
    let headerRowIndex = 0
    let maxMatches = 0
    let detectedHeaders: string[] = []

    // Look at first 10 rows (or fewer if file is small)
    const scanLimit = Math.min(rawRows.length, 10)
    
    for (let i = 0; i < scanLimit; i++) {
        const row = rawRows[i]
        if (!Array.isArray(row)) continue
        
        let matches = 0
        const currentHeaders = row.map(cell => normalizeKey(cell))
        
        // Count matches
        currentHeaders.forEach(h => {
            if (KNOWN_HEADERS.some(kh => h.includes(kh))) {
                matches++
            }
        })

        // Heuristic: If we find a row with more known headers, or equal matches but earlier in file (if 0 matches, stick to 0)
        // Actually, we want the *best* match.
        if (matches > maxMatches) {
            maxMatches = matches
            headerRowIndex = i
            detectedHeaders = currentHeaders
        }
    }

    // Determine effective headers. If no good match found, default to first row or generic keys if empty
    if (maxMatches === 0 && rawRows.length > 0) {
        // Fallback: Use first row as header if it looks like strings, otherwise generate keys
        headerRowIndex = 0
        detectedHeaders = rawRows[0].map((c: any) => normalizeKey(c))
    }

    // 3c. Convert to Objects using Detected Headers
    let rows: any[] = []
    
    // Start reading *after* the header row
    for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
        const rowArray = rawRows[i]
        if (!Array.isArray(rowArray) || rowArray.length === 0) continue;

        const rowObj: any = {}
        // Map values to keys. 
        // Note: rowArray length might be different from detectedHeaders length
        detectedHeaders.forEach((key, index) => {
            if (key && index < rowArray.length) {
                rowObj[key] = rowArray[index]
            }
        })
        
        // Keep any extra columns as _extra_1, etc if needed? 
        // For now, let's stick to mapped headers. 
        // If the row has MORE columns than headers, we might miss data, 
        // but usually headers cover the data.
        
        rows.push(rowObj)
    }

    // Helper to normalize keys for mapping logic below (re-used but logic is same)
    // The keys in 'rows' are already normalized by normalizeKey above.
    const normalizeRow = (row: any) => row // Already normalized keys
    
    const totalRows = rows.length
    const source = upload.source

    // 4. Transform and Insert to Staging
    // We process in batches of 100
    const BATCH_SIZE = 100
    let processedRows = 0
    let successCount = 0
    
    for (let i = 0; i < totalRows; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      const stagingRecords = batch.map((rawRow: any, index: number) => {
        const rowIndex = i + index
        const normalizedRow = normalizeRow(rawRow)

        // Determine target table and schema based on Source
        if (source === 'drivers') {
           // Skip only if the row is entirely empty
           if (Object.keys(normalizedRow).length === 0) {
               return null 
           }

           const fullName = normalizedRow['full_name'] || normalizedRow['name'] || normalizedRow['driver_name'] || normalizedRow['driver']
           const license = normalizedRow['license'] || normalizedRow['license_number'] || normalizedRow['dl'] || normalizedRow['license_no']

           return {
             upload_id: upload.id,
             org_id: upload.org_id,
             row_index: rowIndex,
             status: fullName ? 'pending' : 'error', // Mark as error if minimal ID is missing, but still save it
             raw_data: rawRow, // Persist original unadulterated data!
             full_name: fullName,
             email: normalizedRow['email'] || normalizedRow['email_address'],
             phone: normalizedRow['phone'] || normalizedRow['mobile'] || normalizedRow['cell'] || normalizedRow['contact'],
             license_number: license,
             vehicle_info: normalizedRow['vehicle'] || normalizedRow['car'] || normalizedRow['vehicle_info'] || normalizedRow['make_model'],
             validation_errors: !fullName ? { error: 'Missing full name', missing_fields: ['full_name'] } : null
           }
        } else if (source === 'patients') {
            if (Object.keys(normalizedRow).length === 0) {
               return null 
            }

            const fullName = normalizedRow['full_name'] || normalizedRow['name'] || normalizedRow['patient_name'] || normalizedRow['patient']

            return {
             upload_id: upload.id,
             org_id: upload.org_id,
             row_index: rowIndex,
             status: fullName ? 'pending' : 'error',
             raw_data: rawRow,
             full_name: fullName,
             email: normalizedRow['email'],
             phone: normalizedRow['phone'] || normalizedRow['contact'],
             date_of_birth: normalizedRow['dob'] || normalizedRow['date_of_birth'] || normalizedRow['birth_date'],
             primary_address: normalizedRow['address'] || normalizedRow['primary_address'] || normalizedRow['street_address'],
             notes: normalizedRow['notes'] || normalizedRow['comments'],
             validation_errors: !fullName ? { error: 'Missing full name', missing_fields: ['full_name'] } : null
           }
        } else {
            return null
        }
      }).filter(r => r !== null)

      if (stagingRecords.length > 0) {
          const tableName = source === 'drivers' ? 'staging_drivers' : 'staging_patients'
          const { error: insertError } = await supabase.from(tableName).insert(stagingRecords)
          
          if (insertError) {
             console.error('Batch insert error', insertError)
          } else {
             successCount += stagingRecords.length
          }
      }
      processedRows += batch.length
    }

    // Capture "success but 0 rows" case
    let finalStatus = 'ready_for_review'
    let finalNotes = `Processed ${successCount}/${totalRows} rows successfully.`
    
    if (totalRows > 0 && successCount === 0) {
        finalStatus = 'error'
        finalNotes = 'Failed to map any rows. Please check column headers.'
    }

    // 5. Completion
    await supabase.from('org_uploads').update({ 
        status: finalStatus,
        processed_at: new Date().toISOString(),
        notes: finalNotes
    }).eq('id', upload_id)

    return new Response(
      JSON.stringify({ success: successCount > 0, rows_processed: successCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Edge Function Error:', error)
    
    // Attempt to update status to error
    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        const { upload_id } = await req.json()
        if (upload_id) {
             await supabase.from('org_uploads').update({ 
                status: 'error', 
                error_message: error.message 
             }).eq('id', upload_id)
        }
    } catch (e) { /* ignore */ }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
