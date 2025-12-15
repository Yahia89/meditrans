import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Papa from 'https://esm.sh/papaparse@5.4.1'

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

    // 3. Parse File
    const text = await fileData.text()
    
    // Check file type for parsing strategy (simplified to CSV for now, extendable for Excel)
    // Note: real implementation would check mime_type
    
    const parseResult = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    })

    if (parseResult.errors.length > 0) {
      console.error('CSV Parse Errors', parseResult.errors)
      // We might want to continue if some rows are valid, or fail hard.
      // For now, let's proceed with valid rows but log warning
    }

    const rows = parseResult.data
    const totalRows = rows.length
    const source = upload.source

    // 4. Transform and Insert to Staging
    // We process in batches of 100
    const BATCH_SIZE = 100
    let processedRows = 0
    let successCount = 0
    
    for (let i = 0; i < totalRows; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      const stagingRecords = batch.map((row: any, index: number) => {
        const rowIndex = i + index
        
        // Basic mapping logic - normalize keys to lowercase/snake_case for matching
        const normalizedRow: any = {}
        Object.keys(row).forEach(key => {
            const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '_')
            normalizedRow[cleanKey] = row[key]
        })

        // Determine target table and schema based on Source
        if (source === 'drivers') {
           return {
             upload_id: upload.id,
             org_id: upload.org_id,
             row_index: rowIndex,
             status: 'pending',
             // Smart mapping attempts
             full_name: normalizedRow['full_name'] || normalizedRow['name'] || normalizedRow['driver_name'],
             email: normalizedRow['email'] || normalizedRow['email_address'],
             phone: normalizedRow['phone'] || normalizedRow['mobile'] || normalizedRow['cell'],
             license_number: normalizedRow['license'] || normalizedRow['license_number'] || normalizedRow['dl'],
             vehicle_info: normalizedRow['vehicle'] || normalizedRow['car'] || normalizedRow['vehicle_info'],
             validation_errors: null
           }
        } else if (source === 'patients') {
            return {
             upload_id: upload.id,
             org_id: upload.org_id,
             row_index: rowIndex,
             status: 'pending',
             full_name: normalizedRow['full_name'] || normalizedRow['name'] || normalizedRow['patient_name'],
             email: normalizedRow['email'],
             phone: normalizedRow['phone'],
             date_of_birth: normalizedRow['dob'] || normalizedRow['date_of_birth'] || normalizedRow['birth_date'],
             primary_address: normalizedRow['address'] || normalizedRow['primary_address'],
             notes: normalizedRow['notes'] || normalizedRow['comments'],
             validation_errors: null
           }
        } else {
            // Unknown or Employees - handle generic or skip for now
            return null
        }
      }).filter(r => r !== null)

      if (stagingRecords.length > 0) {
          const tableName = source === 'drivers' ? 'staging_drivers' : 'staging_patients'
          const { error: insertError } = await supabase.from(tableName).insert(stagingRecords)
          
          if (insertError) {
             console.error('Batch insert error', insertError)
             // In production, we might mark this batch as error in a logs table
          } else {
             successCount += stagingRecords.length
          }
      }
      processedRows += batch.length
    }

    // 5. Completion
    await supabase.from('org_uploads').update({ 
        status: 'ready_for_review',
        processed_at: new Date().toISOString(),
        notes: `Processed ${successCount}/${totalRows} rows successfully.`
    }).eq('id', upload_id)

    return new Response(
      JSON.stringify({ success: true, rows_processed: successCount }),
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
