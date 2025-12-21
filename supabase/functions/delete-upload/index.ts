import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    const { upload_id, file_path } = await req.json()

    if (!upload_id && !file_path) {
      throw new Error('Missing upload_id or file_path')
    }

    let pathToDelete = file_path

    // 1. If we have an upload_id and no file_path, fetch it from DB
    if (upload_id && !pathToDelete && !upload_id.startsWith('storage-')) {
      const { data, error: fetchError } = await supabase
        .from('org_uploads')
        .select('file_path')
        .eq('id', upload_id)
        .single()
      
      if (fetchError) {
        console.warn('Could not find upload record to get file path:', fetchError)
      } else {
        pathToDelete = data?.file_path
      }
    }

    // 2. Storage wipe
    if (pathToDelete) {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([pathToDelete])
      
      if (storageError) {
        console.error('Storage deletion failed:', storageError)
        // We continue anyway to attempt DB cleanup
      }
    }

    // 3. DB wipe (if it's a real DB record)
    if (upload_id && !upload_id.startsWith('storage-')) {
      const { error: dbError } = await supabase
        .from('org_uploads')
        .delete()
        .eq('id', upload_id)
      
      if (dbError) throw dbError
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Upload deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Edge Function Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
