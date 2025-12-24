admins after they are invited and accept the invite, and upon uploading, they get the following errors:

but the starnge behavior goes like this, first they get unable to upload, and then are able to review and commit as the flow intended.

it turns out that not only admins, even the account owner faces the first time upload issue, infinite loading, i had to go back and try to upload again, it did show that the file was uploaded and the (patients for example) imported successfully, but the 2nd time and on it works fine.

mind you the admin that i just tested, belongs to the same org and it should stay like that, their context also should match, meaning if admin imported patients with green check mark, account owner should have that, also in the history of uploads, if we can add "committed by".

overall the process needs more testing, and the whole org should be context aware.

XHRHEAD
https://devszzjyobijwldayicb.supabase.co/rest/v1/trips?select=*&org_id=eq.6e34c697-b442-4d3f-b9e7-41fbf942bd14
[HTTP/3 404  104ms]

XHRGET
https://devszzjyobijwldayicb.supabase.co/rest/v1/org_uploads?select=*&id=eq.543e369f-541a-4d2c-a738-204ebc1256aa
[HTTP/3 406  137ms]

XHRGET
https://devszzjyobijwldayicb.supabase.co/rest/v1/org_uploads?select=*&id=eq.543e369f-541a-4d2c-a738-204ebc1256aa
[HTTP/3 406  120ms]

Failed to load review data 
Object { code: "PGRST116", details: "The result contains 0 rows", hint: null, message: "Cannot coerce the result to a single JSON object" }
<anonymous code>:1:147461
Failed to load review data 
Object { code: "PGRST116", details: "The result contains 0 rows", hint: null, message: "Cannot coerce the result to a single JSON object" }