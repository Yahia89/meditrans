logs:

| event_message | event_type | function_id                          | id                                   | level | timestamp        |
| ------------- | ---------- | ------------------------------------ | ------------------------------------ | ----- | ---------------- |
| shutdown      | Shutdown   | c1a364bd-1abb-41d7-8ede-d5137642695a | f01b8a3f-dd13-42a6-8b93-54c3d3b647bc | log   | 1768617711368000 |
| shutdown      | Shutdown   | c1a364bd-1abb-41d7-8ede-d5137642695a | b10444fd-bdc1-4a20-a1b4-0719609fec15 | log   | 1768617711175000 |

| Maps API Error: {"destination_addresses":[],"error_message":"API keys with referer restrictions cannot be used with this API.","origin_addresses":[],"rows":[],"status":"REQUEST_DENIED"}
| Log | c1a364bd-1abb-41d7-8ede-d5137642695a | 6aa90c02-83e5-4e5e-b2eb-7bc56817dfc1 | error | 1768617636649000 |
| Maps API Status: REQUEST_DENIED
| Log | c1a364bd-1abb-41d7-8ede-d5137642695a | ac8bb7ee-b2af-4220-a9b9-717121c3ca04 | info | 1768617636649000 |
| Patient Opt-Out: false
| Log | c1a364bd-1abb-41d7-8ede-d5137642695a | afea89f5-3deb-42d1-8a6f-261d4887ce14 | info | 1768617636569000 |
| Calculating ETA from: 45.029758,-93.2462954 to: 4141 Central Ave NE, Columbia Heights, MN 55421, USA
| Log | c1a364bd-1abb-41d7-8ede-d5137642695a | 06196789-f059-44cb-9e37-a31a6a0cc15a | info | 1768617636569000 |
| Already Sent At: null
| Log | c1a364bd-1abb-41d7-8ede-d5137642695a | 288c75f4-0cf6-4d60-b6fd-f1429eb39d58 | info | 1768617636569000 |
| Trip Status: en_route
| Log | c1a364bd-1abb-41d7-8ede-d5137642695a | d36cee2c-5b94-4c99-8828-6dfe9c60cede | info | 1768617636569000 |
| Patient Phone (raw): +1 (763) 587-5299
| Log | c1a364bd-1abb-41d7-8ede-d5137642695a | 2744b69e-1b17-4a08-9897-f4325874b964 | info | 1768617636569000 |
| Trip fetched successfully
| Log | c1a364bd-1abb-41d7-8ede-d5137642695a | e2fcd9b1-e7b1-48d3-88a6-ada4ab99f862 | info | 1768617636569000 |
| All validations passed, proceeding to ETA calculation
| Log | c1a364bd-1abb-41d7-8ede-d5137642695a | a1e5473c-4ca2-4f08-915a-587ffd04210a | info | 1768617636569000 |
| Driver Lng: -93.2462954
| Log | c1a364bd-1abb-41d7-8ede-d5137642695a | f976058f-7e55-4cc7-be38-67dffb63f919 | info | 1768617636569000 |
| Driver Lat: 45.029758
| Log | c1a364bd-1abb-41d7-8ede-d5137642695a | 26d53aca-f4a8-4670-a64c-56d21748e759 | info | 1768617636569000 |
| Org SMS Enabled: true
| Log | c1a364bd-1abb-41d7-8ede-d5137642695a | 0c4d93ee-9d1c-4aca-a036-d49aa10ab5f8 | info | 1768617636569000 |
| === ETA SMS Function Started ===
| Log | c1a364bd-1abb-41d7-8ede-d5137642695a | 5336d3fc-ddd1-4091-b7f7-c879850cbe3e | info | 1768617636358000 |
| Trip ID: e8e2c35b-1baa-4663-9db3-992baf3fbd88
| Log | c1a364bd-1abb-41d7-8ede-d5137642695a | d4602436-d588-4389-a6dd-b62610b7fdcd | info | 1768617636358000 |
| Listening on http://localhost:9999/
| Log | c1a364bd-1abb-41d7-8ede-d5137642695a | 5c0fe465-baf9-49a6-a48a-969c693686c4 | info | 1768617636353000 |
| booted (time: 42ms) | Boot | c1a364bd-1abb-41d7-8ede-d5137642695a | 5c002f1d-79e7-4644-9de4-4a419aa4dab6 | log | 1768617636348000 |
| Listening on http://localhost:9999/
| Log | c1a364bd-1abb-41d7-8ede-d5137642695a | db8f7a39-d276-4e2c-ac75-bac67350c76b | info | 1768617636151000 |
| booted (time: 42ms) | Boot | c1a364bd-1abb-41d7-8ede-d5137642695a | 0441e418-c9b8-4008-b2a4-64a9dc29a743 | log | 1768617636147000 |

invocations:

| deployment_id                                               | event_message | execution_time_ms | function_id                                                        | id  | method                               | status_code                          | timestamp | version |
| ----------------------------------------------------------- | ------------- | ----------------- | ------------------------------------------------------------------ | --- | ------------------------------------ | ------------------------------------ | --------- | ------- | ---------------- | --- |
| devszzjyobijwldayicb_c1a364bd-1abb-41d7-8ede-d5137642695a_3 | POST          | 200               | https://devszzjyobijwldayicb.supabase.co/functions/v1/send_eta_sms | 426 | c1a364bd-1abb-41d7-8ede-d5137642695a | 6adfabd3-443d-4cad-a616-629257762790 | POST      | 200     | 1768617636657000 | 3   |
| devszzjyobijwldayicb_c1a364bd-1abb-41d7-8ede-d5137642695a_3 | OPTIONS       | 200               | https://devszzjyobijwldayicb.supabase.co/functions/v1/send_eta_sms | 421 | c1a364bd-1abb-41d7-8ede-d5137642695a | 53e8e0ae-e0a7-48f6-aa04-75d948a3c286 | OPTIONS   | 200     | 1768617636162000 | 3   |
