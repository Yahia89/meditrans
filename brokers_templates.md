# brokers templates needed we will implement them that way service providers will create trips in bulk upload way:

**dashes means cell separators**

##template name: access_2_care_template

Template structure:
Business Unit Identifier-Trip Number-Resource-Name-Member DOB-Member Weight-Case Number-Pickup Address-Pickup Address 2-Member Phone-Pickup County-Vehicle Type-Special Needs-Directions-Destination Name-Destination Phone-Destination Address-Destination Address 2-Additional Passenger Count-Additional Passenger-Trip Date-Appointment Time-Pickup Time-Mileage-Provider Notes-Pharmacy Stop Auth-Wheelchair-High Risk-Confirmation Number

##template name: access_2_care_v2_template

Business Unit Identifier-Trip Number-Resource-Rider ID:Name-Firstname-Middlename-Lastname-Member Age-Member DOB-Member Weight-Case Number-Pickup Address-Pickup Address 2-Member Phone-Pickup Address 1-Pickup Address 2-Pickup City-Pickup State-Pickup Zip Code-Pickup County-Pickup Latitude-Pickup Longitude-Vehicle Type-Special Needs-Directions-Payable By-Destination Name-Destination Phone-Destination Address-Destination Address 2-Destination Address 1-Destination Address 2-Destination City-Destination State-Destination Zip Code-Destination Latitude-Destination Longitude-Additional Passenger Count-Additional Passenger-Price-Trip Date-Appointment Time-Pickup Time-Mileage-Provider Notes-Pharmacy Stop Auth-Stretcher-Wheelchair-High Risk-Confirmation Number-Call Priority-All Notes & Special Needs

##template name: alivi_template_e6WxRcj

payorId

##template name: american_logistics_template

Bolt Trip ID-Confirmed Driver Name-Confirmed Driver Phone-Pickup Address-Pickup City-Pickup State-Pickup Zip-Pickup Notes-Pickup Time-Dropoff Address-Dropoff City-Dropoff State-Dropoff Zip-Service Level-Trip Miles-Trip Number-Status-Passenger Name-Passenger Count-Pay Amount-Passenger Phone Number-Cash Fare Amount

##template name: blue_grass_template

RunName-MobilityRequirementType-RequestTime-AppointmentTime-Pickup-CustomerPay-Comments-EstTripDistance-CustomerFirstName-CustomerLastName-Telephone1-OriginStopCommonName-OriginStopAddress-OriginStopCity-OriginStopState-OriginStopZip-OriginComments-DestCommonName-DestAddress-DestCity-DestState-DestZip-DestComments-FundingSourceName-Attendantcount-GuestCount

##template name: call_the_car_template

Trip ID-First Name-Last Name-Gender-LOS-Home Number-Date of Service-Appointment Time-Pickup Time-Request Type-Status-Origin Name-Origin Street-Origin Suite-Origin City-Origin State-Origin Postal-Origin County-Origin Phone-Origin Comments-Destination Name-Destination Street-Destination Suite-Destination City-Destination State-Destination Postal-Destination County-Destination Phone-Destination Comments-Escorts-Type Of Trip-Miles-Member Unique Identifier-Date Of Birth

##template name: cata_template

Has Note-Booking Id-Provider Name-Client Name-Pickup Time-Appt Time-Pickup Polygon-Phone Pickup-Origin-State (orig)-Dropoff Polygon-Phone Dropoffn-Destination-State (dest)-Subtype Abbr-Direct Distance-Passenger Types-Space Type-Provider Cost Dropoff-Total Adjustments-Total Provider Cost-Mobility Aids-Comments-Pickup Comments-Dropoff Comments-Schedule Status

##template name: childrens_services_template

Trip ID-Leg Sequence-Request Reason-Pick Up Date-Pick Up Time-Appointment Time-LOS-Caregiver Name-Client Name-Client DOB-Client Age-Client Gender-Language-Pick Up Location-Pick Up Address-Pick Up City-Pick Up State-Pick Up Zip Code-Pick Up Phone Number-Drop Off Location-Drop Off Address-Drop Off City-Drop Off State-Drop Off Zip Code-Drop Off Phone Number-Est Miles-Number Of Passengers-Number Of Car Seats-Notes-Requestor Name-Requestor Phone Number

##template name: comfort_care_template

Ref-Type-Order Number-Client Name-Special Comments-PU_Time-DO_Time-PU Address-PU city-PU Zip-Destination Name-DO Address-DO City-DO ZIP-Miles

##template name: comfort_care_v2_app_time_template

Space Types-Booking Id-Client Name-Phone Pickup-Comments-Pickup Time-Appointment Time-Site Name(orig)-Origin-Site Name(dest)-Destination-Direct Distance-Mobility Aids

##template name: comfort_care_v2_template

Space Types-Booking Id-Client Name-Phone Pickup-Comments-Pickup Time-Appointment Time-Site Name(orig)-Origin-Site Name(dest)-Destination-Direct Distance-Mobility Aids

##template name: community_action_template

Access Card-DOB-Consumer Name-Address-Phone-Start time-Date-Miles-Destination-Special Needs

##template name: cts_template

Has Note-Booking Id-Provider Name-Client Name-Pickup Time-Appt Time-Pickup Polygon-Phone Pickup-Origin-State (orig)-Dropoff Polygon-Phone Dropoff-Destination-State (dest)-Subtype Abbr-Direct Distance-Passenger Types-Space Types-Provider Cost Dropoff-Total Adjustments-Total Provider Cost-Mobility Aids-Comments-Pickup Comments-Dropoff Comments-Schedule Status

##template name: custom_template

Last Name-First Name-Time-Address-City-State-Zip Code-Home Phone-Location-Payer Type-Start Date-6 Month-1 Year

##template name: dhs_template

Trip Date-Trip Id-Appt Time-Client Id-Client Name-Client Phone Number- -Pickup Address1-Pickup Address2-Pickup City-Pickup State-Pickup Zip- -Destination Address1-Destination Address2-Destination City-Destination State-Destination Zip-Special Accomodation-Emergency Contact Name-Emergency Phone Number-HSP Name-SubContractor Name- -Trip Type- -TP

##template name: ect_template

MediRoutesClient-PickUpTime-PickUpAddressName-Status-MemberName-MemberID-MemberAge-TripType-PickUpPhone-PickUpStreet-PickUpCity-PickUpState-PickUpZip-PickUpNotes-DropOffNotes-DropOffZip-DropOffState-DropOffCity-DropOffStreet-DropOffPhone-DropOffAddressName-DropOffTime-CarSeats-TripID-MobilityType-Escorts-Attendants-Miles-TripLegID-Payor

##fact_template

Passenger Name-Passenger Phone-Passenger Count-Mobility Device-Promised Pick-up Time-Appointment Time-Direct Estimated Distance-Pick-up Location Name-Pick-up Street-Pick-up City-Pick-up ZIP-Pick-up Note-Drop-off Location Name-Drop-off Street-Drop-off City-Drop-off ZIP-Drop-off Note-Co-pay-Trip Status-Trip Date-Trip ID

##federated_template

PU Time-CustomerFirstName-CustomerMiddleInitial-CustomerLastName-Telephone1-OriginStopCommonName-OriginStopAddress-OriginStopCity-OriginStopState-OriginStopZip-DestCommonName-DestAddress-DestCity-DestState-DestZip-EstTripDistance-MobilityRequirementType-Attendantcount-AssistanceNeed-TripID

##fidelis_template

Type-Case #-Plan ID-Member id-First name-Last name-Gender-DOB-PU address-Phone-Service date-PU time-# Of One Vehicle Type Way Trips-Vehicle Type-# Of Riders-Auth Number-Destination info-Notes

##fist_transit_template

Client Name-Requested Time Pickup-Appt Time-Space Types-Mobility Aids-Direct Distance-Origin-Destination-Phone Pickup-Phone Dropoff-Booking Purpose-Comments-Total Provider Cost-Booking Id

##fresno_pace_template

Date-Time-ID-Driver-Name-Address-Zip Code-Phone-Comments-Chief Complaint-Type

##gatra_template

From: **\_\_\_\_** To: **\_\_\_\_**
Operator-Vehicle Type-Name-Phone-Date-Trip Direction-P/U Time-Appt.Time-P/U Address/Entrance-P/U City-Drop Address/Entrance-Drop City-Miles-Fare-Trip Type-Standing Order ID-One Way-Comments

##grits_template

CarSeatCount-CustomerFirstName-CustomerLastName-MobilityRequirementType-RequestTime-Attendantcount-GuestCount-Telephone1-Reservation-Comments-OriginStopCommonName-OriginStopAddress-OriginStopCity-OriginStopState-OriginStopZip-OriginComments-DestCommonName-DestAddress-DestCity-DestState-DestZip-DestComments

##health_partners_template

vendor-seqRideID-seqRideLegID-status-rideDate-primaryRiderExternalMemberID-primaryRiderLastName-primaryRiderFirstName-primaryRiderMiddleInitial-cabRideType-pickupDate-appointmentDate-fromFacilityName-fromStreet1-fromStreet2-fromCity-fromStateDescription-fromZip-fromCounty-fromPhone-toFacilityName-toStreet1-toStreet2-toCity-toStateDescription-toZip-toCounty-toPhone-numberOfRiders-estimatedMileage-instructions-modified-primaryRiderStreet1-primaryRiderStreet2-primaryRiderCity-primaryRiderStateDescription-primaryRiderZip-primaryRiderCounty-primaryRiderPhone-primaryRiderGender-primaryRiderDateOfBirth-mode

##hybrid_it_template

Hybrid Trip ID-Trip #-Patient Name-Account Name-Referral-Office Location-Pick Up Address-Drop Address-Trip Miles-Vehicle Type-Assigned Team Size-Requested Team-Appointment Date-Arrival Time-Pick Time (scheduled)-Drop Time (scheduled)-Appointment Time-Trip Status-Driver-Actual Pick-Up Time-Actual Drop-off Time-Wait Time Option-Estimated Wait Time-Wait Time entered by Driver-Request Comments-Patient Phone-Patient Notes-Trip Type-Driver Name [from app]-Escort Name [from app]-Cancellation Reason-Hybrid Trip ID2

##intelliride_template

Customer Number Type-First Name-Last Name-Mailing Street Number-Mailing Street-Mailing Street Suffix-Mailing City-Mailing Postal Code-Mailing State-Mobility Device-County of Residence-Date of Birth-SSN-Medicaid Number-Passenger Phone-Language-Trip ID-Trip Date-Trip Status-Subscription Number-Reservation Agent-Order Time-Reservation Note-Passenger Count-PCA-Companions-Children-Other Passengers-Cancel Agent-Cancel Time-Cancel Type-Edit Agent-Edit Timestamp-No Show Reason-Wheelchair Count-XL Wheelchair Count-Stretcher Count-SMS Permission-SMS Send Status-SMS Send Time-Will Call Status-External Trip Id-External Data 1-External Data 2-External Data 3-Vehicle Requirement-Cluster ID-Direct Estimated Distance-Direct Estimated Duration (minutes)-Promised Pick-up Time-Promised Drop-off Time-Earliest Pick-up-Latest Pick-up Time-Earliest Drop-off Time-Latest Drop-off Time-Loading Duration-Unloading Duration-Negotiation Window Minus-Negotiation Window Plus-Travel Alone-Use Target Runs-Target Run 1-Target Run 2-Target Run 3- -Pick-up Street Number-Pick-up Street-Pick-up City-Pick-up ZIP-Pick-up County-Pick-up Time-Pick-up Note-Pick-up Phone-Requested Pick-up Time-Reported Pick-up Arrival Time-Reported Pick-up Departure Time-Drop-off Location Name-Drop-off Street Number-Drop-off Street-Drop-off City-Drop-off ZIP-Drop-off County-Drop-off Time-Drop-off Note-Drop-off Phone-Requested Drop-off Time-Reported Drop-Off Arrival Time-Reported Drop-Off Departure Time-Purpose-Funding Source-Sponsor Funding Source name-Full Fare-Major Funding Source Share-Full Client Co-pay-Sponsor Funding Share-Final Client Co-pay-Final Client Co-pay Received-Additional Passenger Fare-Additional Passenger-Fare Received-Fare Distance-Fare Distance Rounded Miles-Fare Type 1-Fare Type 1: quantity-Fare Type 2-Fare Type 2: quantity-Fare Type 3-Fare Type 3: quantity-Subcontractor Rate-Funding custom field 1-Funding custom field 2-Funding custom field 3-Funding custom field 4-Actual Trip Distance-Actual Trip Duration-Run Company-Run ID-Run Group-Driver First Name-Driver Last Name-Client custom field 1-Client custom field 2-Client custom field 3-Client custom field 4-Client custom field 5-Client custom field 6-Client custom field 7-Client custom field 8-Transportation Provider

##isi_template

Client DOB (mm/dd/yyyy)-Client's First Name-Client's Last Name-Phone number (exp. 7161111111)-Client Weight, lb-Client's Sex (male/female)-Client's Account Member ID#-PU address-DO address-Trip Type(should correspond to your trip types)-Capacity AMB (numbers: 1 or 2 ...)-Capacity WC (numbers: 1 or 2 ...)-Capacity ST (numbers: 1 or 2 ...)-Date of service (mm/dd/yyyy)-Appointment time (hh:mm)-Pick up time (hh:mm)-Will call (Yes/No)-Notes-Need Wheelchair (Yes/No)-Need Assistant (Yes/No)-Extra Weight(yes/no) mark yes if it is more then 250 lb-Floor-Room-Bed-Stairs Count(1,2….)-Round Trip(yes/no) if yes - will be created reverse trip

##kaizen_template

Ride ID-Status-Ride Date-First Name-Last Name-Age-Phone-Transportation Type-Cancel Reason-Cost-Pick Up Time-Arrival Time-Estimated Arrival Time-Scheduled Pickup Time-Estimated Distance-Pickup Address-Pickup Lat-Pickup Lng-Pickup Directions-Dropoff Address-Dropoff Lat-Dropoff Lng-Dropoff Directions-Driver First Name-Driver Photo Url-Driver Phone-Vehicle Color-Vehicle Make-Vehicle Model-Vehicle License-Vehicle Photo Url-Provider Name-Provider Trip Id-Rider/Patient ID-Member ID

##laneco_template

Ride ID-Status-Ride Date-First Name-Last Name-Age-Phone-Transportation Type-Cancel Reason-Cost-Pick Up Time-Arrival Time-Estimated Arrival Time-Scheduled Pickup Time-Estimated Distance-Pickup Address-Pickup Lat-Pickup Lng-Pickup Directions-Dropoff Address-Dropoff Lat-Dropoff Lng-Dropoff Directions-Driver First Name-Driver Photo Url-Driver Phone-Vehicle Color-Vehicle Make-Vehicle Model-Vehicle License-Vehicle Photo Url-Provider Name-Provider Trip Id-Rider/Patient ID-Member ID

##lklp_template

Reservation-CustomerFirstName-CustomerLastName-CustomerMiddleInitial-CUSTOMER0.User01-OriginStopCommonName-OriginStopAddress-OriginStopCity-OriginStopState-OriginStopZip-RequestTime-Telephone1-DestCommonName-DestAddress-DestCity-DestState-DestZip-ServiceName-StartDateTime-Attendantcount-AttendantMobilityType-GuestCount-GuestMobilityType-MobilityRequirementType

##logisticare_template

Logisticare Code-Trip IDs-Date of trip-LOS-Name-Days of Week-Type of address-Address 1-Address 2-Phone #-City-State-Zip code-Phone number-Time of pickup-Drop off address type-Drop off address 1-DO address 2-DO Address 3-City-State-DO Zip code-Phone-Appointment time-Nearest 15 minutes-DOB-Age-Sex-Phone- - - - - -Comments-Comments-Comments

##metro_access_template

Date-P/U Time-Customer ID-Customer Name-Phone Numbers Listed-WAV-Pick-Up Address-Pick-Up City-Pick-Up State-Pick-Up Zip Code-Drop-Off Address-Drop-Off City-Drop-Off State-Drop-Off Zip Code-Pick-Up Commnet-Drop-Off Comment-Ref:ID

##mtba_1_template

Fare #-PU Date/Time-Passenger Name-Passenger Phone-VIP #PU Address-DO Address-Remarks- - -

##mtba_3_5_template

Fare #-PU Date/Time-Fleet-Passenger Name-Passenger Phone-PU Address-PU Zone-PU County-DO Address-DO Zone-DO County-Veh Type-Drv Type-Assigned-Driver #-Remarks

##mtba_3_template

Pickup_County-Dest_County-resnumber-Type-DueTime-VehTypes-DriverTypes-AppointmentTime-fleet-DriverID-taxi-PassengerCount-AccountNumber-AccountName-SubAccount-Pickup_Name-Phone-Pickup_CityName-Dest_CityName-distance-Pickup_StreetNumber-Pickup_StreetName-Pickup_zipcode-Apt-Dest_StreetNumber-Dest_StreetName-Dest_zipcode-Remark1-Remark1-Remark1-Remark1-booker

##mtm_template

Medicaid Number-Member's Last Name-Member's First Name-Member's Date of Birth-Member's Age-Member's Phone Number-Member's Alt Phone-Trip Number-Appointment Date-Appointment Day of Week-Appointment Time-Trip Reason Code-Trip Status-Vehicle Type-Trip Type-Wheelchair Flag-Crutches / Walker / Cane Flag-Number of Car Seats Required-Pregnant Flag-Number of Additional Passengers-Additional Passengers With Appointments-Trip Mileage-Trip Cost-Pickup Address-Pickup City-Pickup State-Pickup Zip Code-Delivery Name-Delivery Address-Delivery City-Delivery State-Delivery Zip Code-Delivery Phone Number-Special Needs-Inst / Directions-Return Time-Attendant Flag-Trip Bid Status-Date Trip Bid Status Was Changed-Confirmation Number-Trip Status Date

##mtm_v2_template

Additional Passengers With Appointments-Appointment Date-Appointment Day of Week-Attendant Flag-Car Seats Required-Delivery Address-Delivery City-Delivery Name-Delivery Phone Number-Delivery State-Delivery Zip Code-Driver Name-Driver Notes-Level of Service-Manifest Number-Medicaid Number-Member's Age-Member's Alt Phone-Member's First Name-Member's Last Name-Member's Phone Number-Number of Additional Passengers-Passenger Type-Pickup Address-Pickup City-Pickup State-Pickup Zip Code-Pregnant Flag-Special Needs-Time-Trip Cost-Trip Mileage-Trip Number-Trip Reason-Trip Status-Trip Type-Vehicle-Vehicle Type-Will Call Flag-Date of Birth-Last Edit Date

##nmt_template

AppointmentID-AppointmentDetailID-TripType-TripID-FacilityGroupName-Legcd-ModeofTransportation-Additional passenger No.-FirstName-LastName-CIN-Gender-MemberID-Telephone-BirthDate-Payer-Is_WheelChair-Mileage-PickupDate-PickupScheduleTime-AppointmentTime-OriginAddress-OriginCity-OriginState-OriginZip-OriginFacility-OriginFloorSuite-OriginTelephone-DestinationAddress-DestinationCity-DestinationState-DestinationZip-DestinationFacility-DestinationFloorSuite-DestiantionTelephone-OrderingProvider-ProviderNPI-ProviderStreet-Providercity-ProviderState-ProviderZip-IsTwoManassistneeded-NoofSteps-Height-Weight-ALS-BLS-DiagnosisCode-ReferringOrderingProvider-OxygenRequirement-Flowrate-IsCancelled-ProviderNotes-ClientNotes-Comments-Trip Type

##oak_template

Date-Type-Requested Time-Appointment Type-Appointment_StartTime-Appointment_EndTime-Pick-Up Location-Drop-Off Location-PatientID-PatientName-DOB-PrimaryPhone-Clinic-Clinic_Phone_Number-AdditionalInfo

##one_call_template

Booking Id-Provider Name-HealthplanName-TripDate-Mode-First Name-Last Name-MiddleInitial-Pickup Name-PickupAddress-PickupAddressLine1-PickupCity-PickupState-PickupZip-PickupPhone-DropoffName-DropoffAddress-DropoffAddressLine1-DropoffCity-DropoffState-DropoffZip-DropoffPhone-Client Phone-PickupTime-DropoffTime-Booking Comments-PickupComments-DropoffComments-Mileage-Cost/Rate

##one_call_wc_template

Segment-Order ID-Assignment ID-Offer Status-Claimant's First Name-Claimant's Last Name-Claimant's Ph Number-Scheduled Pick-up Date-Scheduled Pick-up Time-Appointment Date-Appointment Time-Pickup Address Name-From Address-From City-From State-From Zip Code-Dropoff Address Name-To Address-To City-To State-To Zip Code-Distance-Price Est. Cost-Mode-Action-Language-File Number-Notes to Driver

##pace_template

Booking ID-ClientName-SPACEON-Origin street-Origin Comment-Orig Apt-Origin City-Origin Phone-Origin Lon-Origin Lat-SPACEOFF-Dest Street-Dest Comment-Dest Apt-Dest city-Dest Phone-Dest Lon-DLAT-Sched Time-NegTime-Appt Time-Origin Actual Arrive-Origin Actual Depart-Dest Actual Arrive-Dest Actual Depart-Trip Distance-Fare-Fare Collected-Provider Cost-Adjusted Cost-Comments

##priority_health_template

Medicaid Number-Member ID-Member First Name-Member Last Name-DOB-Member Phone Number-Pickup Address-Pickup City-Pickup State-Pickup Zip-Provider FirstName-provider or Facility Name-Provider Address-Provider City-Provider County-Provider State-Provider ZIP-Vendor Name-Vendor Address-Vendor City-Vendor State-Vendor Zip-Transportation Vendor ID-Appointment Date and Time-Request Status-Trip Type-Pharmacy Indicator-Comments-Mobility Equipment

##provide_a_ride_template

Resv. Number-Date-Name-Phone Number-Earliest Pickup-Latest Pickup-Earliest Drop-Off-Latest Drop-Off-org. Common Name-org. Street 1-org. Street 2-org. City-org. State-org. Zip Code-org. County-dst. Common Name-dst. Street 1-dst. Street 2-dst. City-dst. State-dst. Zip Code-dst. County-Miles-G.C.-Mobility Requirement-Guest Mobility-Service Comments- -Status

##~~ride_2_md_template~~ has two rows as headers to categorize things

    												Rider Information											Pick-Up								Drop-Off

Check Provider Reservation Validation messages Error Company Vehicle Code Provider Status Status Special Req Service Animal Driver Driver Phone Rider Phone Age Rider Id Payor Depot Service R. For Transport Date Leg Appointment PU Time ActualPU Address City ZipCode Phone Geo County Actual Drop Address Actual Drop City ZipCode Phone Geo County Loaded Miles Authorization Companions VIP Confirmed SO

##~~ride_2_md_update_template_ZPcwMym~~ has two rows as headers to categorize things

    																	Rider Information													Pick-Up																							Drop-Off

Check Provider Group Reservation Validation messages Error Company Vehicle Code Provider Status Status Reason for Cancel Special Req Service Animal Depot Driver Driver Phone Dispatch Note Rider Phone PU DOB Age Rider Id Payor Pref. Prov. Service R. For Transport Date Leg Appointment Act Time PU Time ActualPU Address City State ZipCode Pick-Up Location Latitude Longitud Phone Alternate Phone Home Phone Geo County Apt/Ste/Rm Actual Drop Address Actual Drop City State ZipCode Drop-Off Location Latitude Longitud Phone Alternate Phone Home Phone Geo County Apt/Ste/Rm Loaded Miles Authorization Companions VIP Confirmed SO Provider Amount

##ride_to_care_template

Customer Number-First Name-Last Name-Trip ID-Trip Date-Trip Status-Mobility Device-Total Passengers-PCA-Cancel Type-Cancel Time-Wheelchair Count-XL Wheelchair Count-Stretcher Count-Vehicle Requirement-Earliest Pick-up-Requested Pick-up Time-Promised Pick-up Time-Requested Drop-off Time-Promised Drop-off Time-Loading Time-Unloading Time-Travel Alone-Driver Note-Pick-up Location Name-Pick-up Street Number-Pick-up Street-Pick-up City-Pick-up ZIP-Pick-up Latitude-Pick-up Longitude-Pick-up Note-Pick-up Phone-Drop-off Location Name-Drop-off Street Number-Drop-off Street-Drop-off City-Drop-off ZIP-Drop-off Note-Drop-off Phone-Drop-off Latitude-Drop-off Longitude-Provider Rate-Provider-Passenger Phone-Direct Estimated Duration (minutes)-Run ID-Driver First Name-Driver Last Name-Vehicle ID-Fare Distance Rounded Miles-Reported Pick-up Arrival Time-Reported Pick-up Departure Time-Reported Drop-Off Arrival Time-Reported Drop-Off Departure Time-Trip Reported Mileage

##route_genie_template

Passenger DOB (mm/dd/yyyy)-Passenger First Name-Passenger Last Name-Phone Number (No spaces or special characters)-Passenger Weight (Numbers only, in lbs)-Passenger Gender (male/female/other)-Passenger Member ID #-PU Address (Street, City, and State Required - Zip code is recommended)-Apt/Suite-Floor-Room-Bed-DO Address (Street, City, and State Required - Zip code is recommended)-Apt/Suite-Floor-Room-Bed-Mode of Transportation (Ambulatory, Wheelchair or Stretcher - Custom Mode must match what is in your system)-Additional Ambulatory Seats (numbers: 1 or 2 ...)-Additional Wheelchair Seats (numbers: 1 or 2 ...)-Date of service (mm/dd/yyyy)-Appointment time (hh:mm) 24 hour clock - Either Appiontment or Pick Up time is required-Pick up time (hh:mm) 24 hour clock - Either Appiontment or Pick Up time is required-Will call (Yes/No) - Not Required. If Yes, time will be ignored for this trip leg.-Round Trip (Yes/No) - Not Required. If Yes, a return trip will automatically be created based on “Return Trip Time”.-Return Trip Time (hh:mm) 24 hour clock - Pickup time of return trip. If blank, return trip is created as a will call.-Needs Wheelchair Provided (Yes/No)-Need Assistant (Yes/No)-Extra Weight (yes/no)-Notes-Trip Purpose

##safe_ride_health_template

rideId-tripId-patientFirstName-patientLastName-dateOfBirth-patientPhoneNumber-requestedVehicleType-pickupTime-appointmentTime-fromAddress-toAddress-additionalNotes-bookedBy-distance-treatment- -

##safe_ride_template

MediRoutesClient-PickUpTime-PickUpAddressName-Status-MemberName-memberID-MemberAge-TripType-PickUpPhone-PickUpStreet-PickUpCity-PickUpState-PickUpZip-PickUpNotes-DropOffNotes-DropOffZip-DropOffState-DropOffCity-DropOffStreet-DropOffPhone-DropOffAddressName-DropOffTime-CarSeats-TripID-MobilityType-Escorts-Attendants-Miles-TripLegID-Payor

##sms_template

Appt Date-Appt Time-Origin Facility-Origin Address-Origin City-Origin Phone-Destination Facility-Destination Address-Destination City-Destination Phone-Ride No-Prov No-Auth No-Assigned Route-Assigned-Passenger Name-+ Pass-Mobility-Wheelchair Size-Shared-Shared Ride ID-Notes

##south_east_trans_template

Client-PickUpTime-PickUpAddressName-Status-MemberName-MemberID-MemberAge-TripType-PickUpPhone-PickUpStreet-PickUpCity-PickUpState-PickUpZip-PickUpNotes-DropOffNotes-DropOffZip-DropOffState-DropOffCity-DropOffStreet-DropOffPhone-DropOffAddressName-DropOffTime-CarSeats-TripID-MobilityType-Escorts-Attendants-Miles-TripLegID-Will Call-Unloaded Miles-Special Rate

##tennesse_template

Client-PickUpTime-PickupAddressName-Status-AuthorizationNumber-MemberName-MemberId-SSN-DateOfBirth-MemberAge-TripType-PickUpPhone-PickUpStreet-PickUpCity-PickUpState-PickUpZip-PickUpNotes-DropOffNotes-DropOffZip-DropOffState-DropOffCity-DropOffStreet-DropOffPhone-DropOffTime-Mobility Aids-MobilityType-Escorts-Attendants-Miles-Reservation Id-TripPurpose-Trip Value

##transcita_template_rStdQGa

FirstName-LastName-BirthDate-MobilePhone-Payer-PU address-Coordinates PU-DO address-Coordinates DO-Mode-Seats-Companion Mobility Aids-PU Date-Pick-Up-Appt Time-Leg Type-DDID-TripPurpose-RideAlone-weight-height-Notes-vip

##transdev_template

Customer Number-First Name-Last Name-Date of Birth-Trip ID-Trip Date-Trip Status-Passenger Count-PCA-Wheelchair Count-Will Call Status-Vehicle Requirement-Cluster ID-Direct Estimated Distance-Direct Estimated Duration (minutes)-Promised Pick-up Time-Promised Drop-off Time-Pick-up Location Name-Pick-up Street Number-Pick-up Street-Pick-up City-Pick-up ZIP-Requested Pick-up Time-Reported Pick-up Arrival Time-Reported Pick-up Departure Time-Drop-off Location Name-Drop-off Street Number-Drop-off Street-Drop-off City-Drop-off ZIP-Requested Drop-off Time-Reported Drop-Off Arrival Time-Reported Drop-Off Departure Time-Purpose-Funding Source-Sponsor Funding Source name-Full Fare-Major Funding Source Share-Full Client Co-pay-Sponsor Funding Share-Final Client Co-pay-Additional Passenger Fare-Fare Distance-Fare Type 1-Fare Type 1: quantity-Actual Trip Distance-Run Company-Run ID-Transportation Provider

##va_template

Trip-Date&Time-Pick-up Address-Drop-off address-Est Cost-Est Distance-Assignments-Notes- - -

##vamc_template_hFqo1K4

Pickup Date-Pick Up Time-Trip Type-Paitent DOB-Patient Name-Escort-Address-Destination-Dest. Note-Phone Number-Mobility Type-Clinic-Appt Time

##vet_ride_template

Trip ID-Vendor Trip ID-Trip Type-Passenger Member ID-Passenger-Phone Number-Mobility-Extra-Estimated Pickup Time-Earliest Departure Time-Latest Arrival Time-Appointment Time-Buffer (minutes)-Pickup Address-Dropoff Address-Estimated Distance (miles)-Third Party-Contract Name-Contract Number-Status-Start Odometer-End Odometer-Start Time-End Time-Comments-VA Notes-Loaded Mileage-Wait Time (Minutes)-Unloaded Mileage-Invoice Number-Invoice Date-Actual Cost

##veyo_template

Confirmation Number (Journey ID)-Trip #-Member Name-Minor-Vehicle Type-Scheduled Pickup Date-Appointment Date-Pickup Address-Drop-off Address-Phone Number-# of Passengers-Actual Pickup Time-Actual Drop-off Time-Pickup Area-Drop-off Area-Combined Areas-Trip Reason-Miles-Trip Instructions-Trip Accepted-Trip Last Updated-Must Fulfill-MNA Trip-Rescue Provider

##veyo_v2_template

Booking Reference # (Journey ID)-Trip #-Member Name-Minor-Vehicle Type-Scheduled Pickup Date OfferOutcomeByUserName OfferOutcomeByUserRole OfferOutcome Appointment Date Pickup Address Drop-off Address Phone Number # of Passengers Actual Pickup Time Actual Drop-off Time Pickup Area Drop-off Area Combined Areas Trip Reason Miles Trip Instructions Trip Accepted Trip Last Updated Must Fulfill MNA Trip Rescue Provider

# \*\*Future NEMT Transportation template (our own), create one out of this schema/definition please:

\*\*
create table public.trips (
id uuid not null default gen_random_uuid (),
org_id uuid not null,
patient_id uuid null,
driver_id uuid null,
scheduled_time timestamp with time zone null,
status text null default 'pending'::text,
destination text null,
notes text null,
created_at timestamp with time zone null default now(),
updated_at timestamp with time zone null default now(),
pickup_location text null,
dropoff_location text null,
pickup_time timestamp with time zone null,
trip_type text null,
status_requested text null,
status_requested_at timestamp with time zone null,
cancel_reason text null,
cancel_explanation text null,
distance_miles numeric null,
duration_minutes numeric null,
signature_data text null,
signature_captured_at timestamp with time zone null,
signed_by_name text null,
signature_declined boolean null default false,
signature_declined_reason text null,
actual_distance_miles numeric null,
actual_duration_minutes numeric null,
eta_sms_sent_at timestamp with time zone null,
waiting_start_time timestamp with time zone null,
total_waiting_minutes numeric null default 0,
constraint trips_pkey primary key (id),
constraint trips_driver_id_fkey foreign KEY (driver_id) references drivers (id) on delete set null,
constraint trips_org_id_fkey foreign KEY (org_id) references organizations (id) on delete CASCADE,
constraint trips_patient_id_fkey foreign KEY (patient_id) references patients (id) on delete set null,
constraint trips_status_check check (
(
status = any (
array[
'pending'::text,
'assigned'::text,
'accepted'::text,
'en_route'::text,
'arrived'::text,
'waiting'::text,
'in_progress'::text,
'completed'::text,
'cancelled'::text,
'no_show'::text
]
)
)
)
) TABLESPACE pg_default;

create index IF not exists trips_created_at_idx on public.trips using btree (created_at) TABLESPACE pg_default;

create index IF not exists trips_patient_id_idx on public.trips using btree (patient_id) TABLESPACE pg_default;

create index IF not exists idx_trips_signature_captured_at on public.trips using btree (signature_captured_at) TABLESPACE pg_default
where
(signature_captured_at is not null);

create index IF not exists trips_signature_declined_idx on public.trips using btree (signature_declined) TABLESPACE pg_default;

create index IF not exists trips_trip_type_idx on public.trips using btree (trip_type) TABLESPACE pg_default;

create index IF not exists trips_org_id_idx on public.trips using btree (org_id) TABLESPACE pg_default;
