/**
 * Broker Templates for Bulk Trip Import
 *
 * This file contains all the template definitions for different brokers.
 * Each template defines the expected CSV/Excel columns for that broker.
 */

export interface BrokerTemplateField {
  name: string;
  required: boolean;
  mapTo?: keyof TripImportRow; // Maps to our internal trip structure
  description?: string;
}

export interface BrokerTemplate {
  id: string;
  name: string;
  displayName: string;
  fields: BrokerTemplateField[];
}

/**
 * Internal representation of a trip row after import
 */
export interface TripImportRow {
  // Patient Information
  patient_first_name?: string;
  patient_last_name?: string;
  patient_full_name?: string;
  patient_dob?: string;
  patient_phone?: string;
  patient_member_id?: string;
  patient_gender?: string;
  patient_weight?: string;

  // Pickup Information
  pickup_address?: string;
  pickup_address_2?: string;
  pickup_city?: string;
  pickup_state?: string;
  pickup_zip?: string;
  pickup_county?: string;
  pickup_latitude?: string;
  pickup_longitude?: string;
  pickup_phone?: string;
  pickup_location_name?: string;
  pickup_notes?: string;

  // Dropoff Information
  dropoff_address?: string;
  dropoff_address_2?: string;
  dropoff_city?: string;
  dropoff_state?: string;
  dropoff_zip?: string;
  dropoff_county?: string;
  dropoff_latitude?: string;
  dropoff_longitude?: string;
  dropoff_phone?: string;
  dropoff_location_name?: string;
  dropoff_notes?: string;

  // Trip Details
  trip_date?: string;
  pickup_time?: string;
  appointment_time?: string;
  trip_type?: string;
  trip_number?: string;
  trip_id?: string;
  status?: string;

  // Trip Specifics
  distance_miles?: string;
  duration_minutes?: string;
  vehicle_type?: string;
  mobility_needs?: string;
  special_needs?: string;
  wheelchair?: string;
  stretcher?: string;

  // Additional Passengers
  additional_passengers?: string;
  passenger_count?: string;
  escorts?: string;
  attendants?: string;

  // Other
  notes?: string;
  authorization_number?: string;
  case_number?: string;
  confirmation_number?: string;

  // Validation
  _validation_errors?: string[];
  _original_row?: any;
}

// Helper to create simple fields from a dash-separated string
function createFields(
  structure: string,
  mappings: Record<string, keyof TripImportRow> = {},
): BrokerTemplateField[] {
  return structure.split("-").map((name) => ({
    name: name.trim(),
    required: [
      "Name",
      "Address",
      "Street",
      "Date",
      "Phone",
      "Time",
      "Pickup",
      "Origin",
      "Destination",
    ].some((req) => name.toLowerCase().includes(req.toLowerCase())),
    mapTo: mappings[name.trim()],
  }));
}

// Define all broker templates
export const BROKER_TEMPLATES: BrokerTemplate[] = [
  {
    id: "access_2_care_template",
    name: "access_2_care_template",
    displayName: "access_2_care_template",
    fields: createFields(
      "Business Unit Identifier-Trip Number-Resource-Name-Member DOB-Member Weight-Case Number-Pickup Address-Pickup Address 2-Member Phone-Pickup County-Vehicle Type-Special Needs-Directions-Destination Name-Destination Phone-Destination Address-Destination Address 2-Additional Passenger Count-Additional Passenger-Trip Date-Appointment Time-Pickup Time-Mileage-Provider Notes-Pharmacy Stop Auth-Wheelchair-High Risk-Confirmation Number",
      {
        "Trip Number": "trip_number",
        Name: "patient_full_name",
        "Member DOB": "patient_dob",
        "Pickup Address": "pickup_address",
        "Member Phone": "patient_phone",
        "Destination Address": "dropoff_address",
        "Trip Date": "trip_date",
        "Appointment Time": "appointment_time",
        "Pickup Time": "pickup_time",
        Mileage: "distance_miles",
      },
    ),
  },
  {
    id: "access_2_care_v2_template",
    name: "access_2_care_v2_template",
    displayName: "access_2_care_v2_template",
    fields: createFields(
      "Trip Number-Rider ID:Name-Firstname-Lastname-Member DOB-Pickup Address 1-Pickup City-Pickup State-Pickup Zip Code-Destination Address 1-Destination City-Destination State-Destination Zip Code-Trip Date-Appointment Time-Pickup Time-Mileage-All Notes & Special Needs",
      {
        "Trip Number": "trip_number",
        Firstname: "patient_first_name",
        Lastname: "patient_last_name",
        "Member DOB": "patient_dob",
        "Pickup Address 1": "pickup_address",
        "Pickup City": "pickup_city",
        "Pickup State": "pickup_state",
        "Pickup Zip Code": "pickup_zip",
        "Destination Address 1": "dropoff_address",
        "Destination City": "dropoff_city",
        "Destination State": "dropoff_state",
        "Destination Zip Code": "dropoff_zip",
        "Trip Date": "trip_date",
        "Appointment Time": "appointment_time",
        "Pickup Time": "pickup_time",
        Mileage: "distance_miles",
        "All Notes & Special Needs": "notes",
      },
    ),
  },
  {
    id: "alivi_template_e6WxRcj",
    name: "alivi_template_e6WxRcj",
    displayName: "alivi_template_e6WxRcj",
    fields: createFields("payorId"),
  },
  {
    id: "american_logistics_template",
    name: "american_logistics_template",
    displayName: "american_logistics_template",
    fields: createFields(
      "Bolt Trip ID-Pickup Address-Pickup City-Pickup State-Pickup Zip-Pickup Time-Dropoff Address-Dropoff City-Dropoff State-Dropoff Zip-Passenger Name-Passenger Phone Number",
      {
        "Bolt Trip ID": "trip_id",
        "Pickup Address": "pickup_address",
        "Pickup City": "pickup_city",
        "Pickup State": "pickup_state",
        "Pickup Zip": "pickup_zip",
        "Pickup Time": "pickup_time",
        "Dropoff Address": "dropoff_address",
        "Dropoff City": "dropoff_city",
        "Dropoff State": "dropoff_state",
        "Dropoff Zip": "dropoff_zip",
        "Passenger Name": "patient_full_name",
        "Passenger Phone Number": "patient_phone",
      },
    ),
  },
  {
    id: "blue_grass_template",
    name: "blue_grass_template",
    displayName: "blue_grass_template",
    fields: createFields(
      "CustomerFirstName-CustomerLastName-OriginStopAddress-OriginStopCity-OriginStopState-OriginStopZip-DestAddress-DestCity-DestState-DestZip-Pickup",
      {
        CustomerFirstName: "patient_first_name",
        CustomerLastName: "patient_last_name",
        OriginStopAddress: "pickup_address",
        OriginStopCity: "pickup_city",
        OriginStopState: "pickup_state",
        OriginStopZip: "pickup_zip",
        DestAddress: "dropoff_address",
        DestCity: "dropoff_city",
        DestState: "dropoff_state",
        DestZip: "dropoff_zip",
        Pickup: "trip_date",
      },
    ),
  },
  {
    id: "call_the_car_template",
    name: "call_the_car_template",
    displayName: "call_the_car_template",
    fields: createFields(
      "Trip ID-First Name-Last Name-Date of Service-Appointment Time-Pickup Time-Origin Street-Origin City-Destination Street-Destination City-Miles-Date Of Birth",
      {
        "Trip ID": "trip_id",
        "First Name": "patient_first_name",
        "Last Name": "patient_last_name",
        "Date of Service": "trip_date",
        "Appointment Time": "appointment_time",
        "Pickup Time": "pickup_time",
        "Origin Street": "pickup_address",
        "Origin City": "pickup_city",
        "Destination Street": "dropoff_address",
        "Destination City": "dropoff_city",
        Miles: "distance_miles",
        "Date Of Birth": "patient_dob",
      },
    ),
  },
  {
    id: "cata_template",
    name: "cata_template",
    displayName: "cata_template",
    fields: createFields(
      "Booking Id-Client Name-Pickup Time-Appt Time-Origin-Destination-Direct Distance",
      {
        "Booking Id": "trip_id",
        "Client Name": "patient_full_name",
        "Pickup Time": "pickup_time",
        "Appt Time": "appointment_time",
        Origin: "pickup_address",
        Destination: "dropoff_address",
        "Direct Distance": "distance_miles",
      },
    ),
  },
  {
    id: "childrens_services_template",
    name: "childrens_services_template",
    displayName: "childrens_services_template",
    fields: createFields(
      "Trip ID-Pick Up Date-Pick Up Time-Appointment Time-Client Name-Client DOB-Pick Up Address-Pick Up City-Drop Off Address-Drop Off City-Est Miles",
      {
        "Trip ID": "trip_id",
        "Pick Up Date": "trip_date",
        "Pick Up Time": "pickup_time",
        "Appointment Time": "appointment_time",
        "Client Name": "patient_full_name",
        "Client DOB": "patient_dob",
        "Pick Up Address": "pickup_address",
        "Pick Up City": "pickup_city",
        "Drop Off Address": "dropoff_address",
        "Drop Off City": "dropoff_city",
        "Est Miles": "distance_miles",
      },
    ),
  },
  {
    id: "comfort_care_template",
    name: "comfort_care_template",
    displayName: "comfort_care_template",
    fields: createFields(
      "Order Number-Client Name-PU_Time-PU Address-PU city-PU Zip-DO Address-DO City-DO ZIP-Miles",
      {
        "Client Name": "patient_full_name",
        PU_Time: "pickup_time",
        "PU Address": "pickup_address",
        "DO Address": "dropoff_address",
        Miles: "distance_miles",
      },
    ),
  },
  {
    id: "comfort_care_v2_app_time_template",
    name: "comfort_care_v2_app_time_template",
    displayName: "comfort_care_v2_app_time_template",
    fields: createFields(
      "Space Types-Booking Id-Client Name-Phone Pickup-Comments-Pickup Time-Appointment Time-Site Name(orig)-Origin-Site Name(dest)-Destination-Direct Distance-Mobility Aids",
      {
        "Booking Id": "trip_id",
        "Client Name": "patient_full_name",
        "Pickup Time": "pickup_time",
        "Appointment Time": "appointment_time",
        Origin: "pickup_address",
        Destination: "dropoff_address",
        "Direct Distance": "distance_miles",
      },
    ),
  },
  {
    id: "comfort_care_v2_template",
    name: "comfort_care_v2_template",
    displayName: "comfort_care_v2_template",
    fields: createFields(
      "Space Types-Booking Id-Client Name-Phone Pickup-Comments-Pickup Time-Appointment Time-Site Name(orig)-Origin-Site Name(dest)-Destination-Direct Distance-Mobility Aids",
      {
        "Booking Id": "trip_id",
        "Client Name": "patient_full_name",
        "Pickup Time": "pickup_time",
        "Appointment Time": "appointment_time",
        Origin: "pickup_address",
        Destination: "dropoff_address",
        "Direct Distance": "distance_miles",
      },
    ),
  },
  {
    id: "community_action_template",
    name: "community_action_template",
    displayName: "community_action_template",
    fields: createFields(
      "Consumer Name-DOB-Address-Phone-Start time-Date-Miles-Destination",
      {
        "Consumer Name": "patient_full_name",
        DOB: "patient_dob",
        Address: "pickup_address",
        Phone: "patient_phone",
        "Start time": "pickup_time",
        Date: "trip_date",
        Miles: "distance_miles",
        Destination: "dropoff_address",
      },
    ),
  },
  {
    id: "cts_template",
    name: "cts_template",
    displayName: "cts_template",
    fields: createFields(
      "Booking Id-Client Name-Pickup Time-Appt Time-Origin-Destination-Direct Distance",
      {
        "Booking Id": "trip_id",
        "Client Name": "patient_full_name",
        "Pickup Time": "pickup_time",
        "Appt Time": "appointment_time",
        Origin: "pickup_address",
        Destination: "dropoff_address",
        "Direct Distance": "distance_miles",
      },
    ),
  },
  {
    id: "custom_template",
    name: "custom_template",
    displayName: "custom_template",
    fields: createFields(
      "Last Name-First Name-Time-Address-City-State-Zip Code-Home Phone-Location-Payer Type-Start Date-6 Month-1 Year",
      {
        "Last Name": "patient_last_name",
        "First Name": "patient_first_name",
        Time: "pickup_time",
        Address: "pickup_address",
        "Zip Code": "pickup_zip",
        "Home Phone": "patient_phone",
        "Start Date": "trip_date",
      },
    ),
  },
  {
    id: "dhs_template",
    name: "dhs_template",
    displayName: "dhs_template",
    fields: createFields(
      "Trip Date-Trip Id-Appt Time-Client Name-Pickup Address1-Pickup City-Pickup State-Pickup Zip-Destination Address1-Destination City-Destination State-Destination Zip",
      {
        "Trip Date": "trip_date",
        "Trip Id": "trip_id",
        "Appt Time": "appointment_time",
        "Client Name": "patient_full_name",
        "Pickup Address1": "pickup_address",
        "Pickup City": "pickup_city",
        "Pickup State": "pickup_state",
        "Pickup Zip": "pickup_zip",
        "Destination Address1": "dropoff_address",
        "Destination City": "dropoff_city",
        "Destination State": "dropoff_state",
        "Destination Zip": "dropoff_zip",
      },
    ),
  },
  {
    id: "ect_template",
    name: "ect_template",
    displayName: "ect_template",
    fields: createFields(
      "MemberName-PickUpTime-PickUpStreet-DropOffStreet-Miles",
      {
        MemberName: "patient_full_name",
        PickUpTime: "pickup_time",
        PickUpStreet: "pickup_address",
        DropOffStreet: "dropoff_address",
        Miles: "distance_miles",
      },
    ),
  },
  {
    id: "fact_template",
    name: "fact_template",
    displayName: "fact_template",
    fields: createFields(
      "Passenger Name-Passenger Phone-Promised Pick-up Time-Appointment Time-Pick-up Street-Drop-off Street-Trip Date-Trip ID",
      {
        "Passenger Name": "patient_full_name",
        "Passenger Phone": "patient_phone",
        "Promised Pick-up Time": "pickup_time",
        "Appointment Time": "appointment_time",
        "Pick-up Street": "pickup_address",
        "Drop-off Street": "dropoff_address",
        "Trip Date": "trip_date",
        "Trip ID": "trip_id",
      },
    ),
  },
  {
    id: "federated_template",
    name: "federated_template",
    displayName: "federated_template",
    fields: createFields(
      "CustomerFirstName-CustomerLastName-OriginStopAddress-DestAddress-PU Time-TripID",
      {
        CustomerFirstName: "patient_first_name",
        CustomerLastName: "patient_last_name",
        OriginStopAddress: "pickup_address",
        DestAddress: "dropoff_address",
        "PU Time": "pickup_time",
        TripID: "trip_id",
      },
    ),
  },
  {
    id: "fidelis_template",
    name: "fidelis_template",
    displayName: "fidelis_template",
    fields: createFields(
      "First name-Last name-DOB-PU address-Phone-Service date-PU time-Destination info",
      {
        "First name": "patient_first_name",
        "Last name": "patient_last_name",
        DOB: "patient_dob",
        "PU address": "pickup_address",
        Phone: "patient_phone",
        "Service date": "trip_date",
        "PU time": "pickup_time",
        "Destination info": "dropoff_address",
      },
    ),
  },
  {
    id: "fist_transit_template",
    name: "fist_transit_template",
    displayName: "fist_transit_template",
    fields: createFields(
      "Client Name-Requested Time Pickup-Appt Time-Origin-Destination-Booking Id",
      {
        "Client Name": "patient_full_name",
        "Requested Time Pickup": "pickup_time",
        "Appt Time": "appointment_time",
        Origin: "pickup_address",
        Destination: "dropoff_address",
        "Booking Id": "trip_id",
      },
    ),
  },
  {
    id: "fresno_pace_template",
    name: "fresno_pace_template",
    displayName: "fresno_pace_template",
    fields: createFields(
      "Date-Time-Name-Address-Zip Code-Phone-Chief Complaint",
      {
        Date: "trip_date",
        Time: "pickup_time",
        Name: "patient_full_name",
        Address: "pickup_address",
        "Zip Code": "pickup_zip",
        Phone: "patient_phone",
      },
    ),
  },
  {
    id: "gatra_template",
    name: "gatra_template",
    displayName: "gatra_template",
    fields: createFields(
      "Name-Phone-Date-P/U Time-Appt.Time-P/U Address/Entrance-P/U City-Drop Address/Entrance-Drop City-Miles",
      {
        Name: "patient_full_name",
        Phone: "patient_phone",
        Date: "trip_date",
        "P/U Time": "pickup_time",
        "Appt.Time": "appointment_time",
        "P/U Address/Entrance": "pickup_address",
        "P/U City": "pickup_city",
        "Drop Address/Entrance": "dropoff_address",
        "Drop City": "dropoff_city",
        Miles: "distance_miles",
      },
    ),
  },
  {
    id: "grits_template",
    name: "grits_template",
    displayName: "grits_template",
    fields: createFields(
      "CustomerFirstName-CustomerLastName-RequestTime-OriginStopAddress-OriginStopCity-OriginStopZip-DestCommonName-DestAddress-DestCity-DestZip",
      {
        CustomerFirstName: "patient_first_name",
        CustomerLastName: "patient_last_name",
        RequestTime: "pickup_time",
        OriginStopAddress: "pickup_address",
        OriginStopCity: "pickup_city",
        OriginStopState: "pickup_state",
        OriginStopZip: "pickup_zip",
        DestAddress: "dropoff_address",
        DestCity: "dropoff_city",
        DestState: "dropoff_state",
        DestZip: "dropoff_zip",
      },
    ),
  },
  {
    id: "health_partners_template",
    name: "health_partners_template",
    displayName: "health_partners_template",
    fields: createFields(
      "rideDate-primaryRiderLastName-primaryRiderFirstName-pickupDate-appointmentDate-fromStreet1-fromCity-fromZip-toStreet1-toCity-toZip",
      {
        rideDate: "trip_date",
        primaryRiderLastName: "patient_last_name",
        primaryRiderFirstName: "patient_first_name",
        pickupDate: "pickup_time",
        appointmentDate: "appointment_time",
        fromStreet1: "pickup_address",
        fromCity: "pickup_city",
        fromZip: "pickup_zip",
        toStreet1: "dropoff_address",
        toCity: "dropoff_city",
        toZip: "dropoff_zip",
      },
    ),
  },
  {
    id: "hybrid_it_template",
    name: "hybrid_it_template",
    displayName: "hybrid_it_template",
    fields: createFields(
      "Trip #-Patient Name-Pick Up Address-Drop Address-Trip Miles-Appointment Date-Appointment Time-Patient Phone",
      {
        "Trip #": "trip_number",
        "Patient Name": "patient_full_name",
        "Pick Up Address": "pickup_address",
        "Drop Address": "dropoff_address",
        "Trip Miles": "distance_miles",
        "Appointment Date": "trip_date",
        "Appointment Time": "appointment_time",
        "Patient Phone": "patient_phone",
      },
    ),
  },
  {
    id: "intelliride_template",
    name: "intelliride_template",
    displayName: "intelliride_template",
    fields: createFields(
      "First Name-Last Name-Date of Birth-Passenger Phone-Trip ID-Trip Date-Promised Pick-up Time-Pick-up Street-Pick-up City-Pick-up ZIP-Drop-off Street-Drop-off City-Drop-off ZIP-Direct Estimated Distance",
      {
        "First Name": "patient_first_name",
        "Last Name": "patient_last_name",
        "Date of Birth": "patient_dob",
        "Passenger Phone": "patient_phone",
        "Trip ID": "trip_id",
        "Trip Date": "trip_date",
        "Promised Pick-up Time": "pickup_time",
        "Pick-up Street": "pickup_address",
        "Pick-up City": "pickup_city",
        "Pick-up ZIP": "pickup_zip",
        "Drop-off Street": "dropoff_address",
        "Drop-off City": "dropoff_city",
        "Drop-off ZIP": "dropoff_zip",
        "Direct Estimated Distance": "distance_miles",
      },
    ),
  },
  {
    id: "isi_template",
    name: "isi_template",
    displayName: "isi_template",
    fields: createFields(
      "Client DOB (mm/dd/yyyy)-Client's First Name-Client's Last Name-Phone number-Date of service-Appointment time-Pick up time-PU address-DO address",
      {
        "Client DOB (mm/dd/yyyy)": "patient_dob",
        "Client's First Name": "patient_first_name",
        "Client's Last Name": "patient_last_name",
        "Phone number": "patient_phone",
        "Date of service": "trip_date",
        "Appointment time": "appointment_time",
        "Pick up time": "pickup_time",
        "PU address": "pickup_address",
        "DO address": "dropoff_address",
      },
    ),
  },
  {
    id: "kaizen_template",
    name: "kaizen_template",
    displayName: "kaizen_template",
    fields: createFields(
      "Ride ID-Ride Date-First Name-Last Name-Phone-Pick Up Time-Pickup Address-Dropoff Address-Estimated Distance",
      {
        "Ride ID": "trip_id",
        "Ride Date": "trip_date",
        "First Name": "patient_first_name",
        "Last Name": "patient_last_name",
        Phone: "patient_phone",
        "Pick Up Time": "pickup_time",
        "Pickup Address": "pickup_address",
        "Dropoff Address": "dropoff_address",
        "Estimated Distance": "distance_miles",
      },
    ),
  },
  {
    id: "laneco_template",
    name: "laneco_template",
    displayName: "laneco_template",
    fields: createFields(
      "Ride ID-Ride Date-First Name-Last Name-Phone-Pick Up Time-Pickup Address-Dropoff Address-Estimated Distance",
      {
        "Ride ID": "trip_id",
        "Ride Date": "trip_date",
        "First Name": "patient_first_name",
        "Last Name": "patient_last_name",
        Phone: "patient_phone",
        "Pick Up Time": "pickup_time",
        "Pickup Address": "pickup_address",
        "Dropoff Address": "dropoff_address",
        "Estimated Distance": "distance_miles",
      },
    ),
  },
  {
    id: "lklp_template",
    name: "lklp_template",
    displayName: "lklp_template",
    fields: createFields(
      "CustomerFirstName-CustomerLastName-OriginStopAddress-OriginStopCity-OriginStopZip-RequestTime-Telephone1-DestAddress-StartDateTime",
      {
        CustomerFirstName: "patient_first_name",
        CustomerLastName: "patient_last_name",
        OriginStopAddress: "pickup_address",
        OriginStopCity: "pickup_city",
        OriginStopZip: "pickup_zip",
        RequestTime: "pickup_time",
        Telephone1: "patient_phone",
        DestAddress: "dropoff_address",
        StartDateTime: "trip_date",
      },
    ),
  },
  {
    id: "logisticare_template",
    name: "logisticare_template",
    displayName: "logisticare_template",
    fields: createFields(
      "Date of trip-Name-Address 1-City-State-Zip code-Time of pickup-Drop off address 1-DO Zip code-Appointment time-DOB",
      {
        "Date of trip": "trip_date",
        Name: "patient_full_name",
        "Address 1": "pickup_address",
        City: "pickup_city",
        State: "pickup_state",
        "Zip code": "pickup_zip",
        "Time of pickup": "pickup_time",
        "Drop off address 1": "dropoff_address",
        "DO Zip code": "dropoff_zip",
        "Appointment time": "appointment_time",
        DOB: "patient_dob",
      },
    ),
  },
  {
    id: "metro_access_template",
    name: "metro_access_template",
    displayName: "metro_access_template",
    fields: createFields(
      "Date-P/U Time-Customer Name-Pick-Up Address-Pick-Up City-Pick-Up Zip Code-Drop-Off Address-Drop-Off City-Drop-Off Zip Code",
      {
        Date: "trip_date",
        "P/U Time": "pickup_time",
        "Customer Name": "patient_full_name",
        "Pick-Up Address": "pickup_address",
        "Pick-Up City": "pickup_city",
        "Pick-Up Zip Code": "pickup_zip",
        "Drop-Off Address": "dropoff_address",
        "Drop-Off City": "dropoff_city",
        "Drop-Off Zip Code": "dropoff_zip",
      },
    ),
  },
  {
    id: "mtba_1_template",
    name: "mtba_1_template",
    displayName: "mtba_1_template",
    fields: createFields(
      "PU Date/Time-Passenger Name-Passenger Phone-PU Address-DO Address",
      {
        "PU Date/Time": "pickup_time",
        "Passenger Name": "patient_full_name",
        "Passenger Phone": "patient_phone",
        "PU Address": "pickup_address",
        "DO Address": "dropoff_address",
      },
    ),
  },
  {
    id: "mtba_3_5_template",
    name: "mtba_3_5_template",
    displayName: "mtba_3_5_template",
    fields: createFields(
      "Fare #-PU Date/Time-Fleet-Passenger Name-Passenger Phone-PU Address-PU Zone-PU County-DO Address-DO Zone-DO County-Veh Type-Drv Type-Assigned-Driver #-Remarks",
      {
        "PU Date/Time": "pickup_time",
        "Passenger Name": "patient_full_name",
        "Passenger Phone": "patient_phone",
        "PU Address": "pickup_address",
        "DO Address": "dropoff_address",
      },
    ),
  },
  {
    id: "mtba_3_template",
    name: "mtba_3_template",
    displayName: "mtba_3_template",
    fields: createFields(
      "resnumber-Type-DueTime-VehTypes-DriverTypes-AppointmentTime-fleet-DriverID-taxi-PassengerCount-AccountNumber-AccountName-SubAccount-Pickup_Name-Phone-Pickup_CityName-Dest_CityName-distance-Pickup_StreetNumber-Pickup_StreetName-Pickup_zipcode-Apt-Dest_StreetNumber-Dest_StreetName-Dest_zipcode-Remark1",
      {
        DueTime: "pickup_time",
        AppointmentTime: "appointment_time",
        Pickup_Name: "patient_full_name",
        Phone: "patient_phone",
        distance: "distance_miles",
        Pickup_StreetName: "pickup_address",
        Dest_StreetName: "dropoff_address",
        Pickup_zipcode: "pickup_zip",
        Dest_zipcode: "dropoff_zip",
      },
    ),
  },
  {
    id: "mtm_template",
    name: "mtm_template",
    displayName: "mtm_template",
    fields: createFields(
      "Member's Last Name-Member's First Name-Appointment Date-Appointment Time-Pickup Address-Pickup City-Pickup Zip Code-Delivery Address-Delivery City-Delivery Zip Code-Trip Mileage",
      {
        "Member's Last Name": "patient_last_name",
        "Member's First Name": "patient_first_name",
        "Appointment Date": "trip_date",
        "Appointment Time": "appointment_time",
        "Pickup Address": "pickup_address",
        "Pickup City": "pickup_city",
        "Pickup Zip Code": "pickup_zip",
        "Delivery Address": "dropoff_address",
        "Delivery City": "dropoff_city",
        "Delivery Zip Code": "dropoff_zip",
        "Trip Mileage": "distance_miles",
      },
    ),
  },
  {
    id: "mtm_v2_template",
    name: "mtm_v2_template",
    displayName: "mtm_v2_template",
    fields: createFields(
      "Member's First Name-Member's Last Name-Appointment Date-Time-Pickup Address-Pickup City-Pickup Zip Code-Delivery Address-Delivery City-Delivery Zip Code-Trip Mileage",
      {
        "Member's First Name": "patient_first_name",
        "Member's Last Name": "patient_last_name",
        "Appointment Date": "trip_date",
        Time: "pickup_time",
        "Pickup Address": "pickup_address",
        "Pickup City": "pickup_city",
        "Pickup Zip Code": "pickup_zip",
        "Delivery Address": "dropoff_address",
        "Delivery City": "dropoff_city",
        "Delivery Zip Code": "dropoff_zip",
        "Trip Mileage": "distance_miles",
      },
    ),
  },
  {
    id: "nmt_template",
    name: "nmt_template",
    displayName: "nmt_template",
    fields: createFields(
      "FirstName-LastName-PickupDate-PickupScheduleTime-AppointmentTime-OriginAddress-OriginCity-OriginZip-DestinationAddress-DestinationCity-DestinationZip",
      {
        FirstName: "patient_first_name",
        LastName: "patient_last_name",
        PickupDate: "trip_date",
        PickupScheduleTime: "pickup_time",
        AppointmentTime: "appointment_time",
        OriginAddress: "pickup_address",
        OriginCity: "pickup_city",
        OriginZip: "pickup_zip",
        DestinationAddress: "dropoff_address",
        DestinationCity: "dropoff_city",
        DestinationZip: "dropoff_zip",
      },
    ),
  },
  {
    id: "oak_template",
    name: "oak_template",
    displayName: "oak_template",
    fields: createFields(
      "Date-Requested Time-Pick-Up Location-Drop-Off Location-PatientName-DOB-PrimaryPhone",
      {
        Date: "trip_date",
        "Requested Time": "pickup_time",
        "Pick-Up Location": "pickup_address",
        "Drop-Off Location": "dropoff_address",
        PatientName: "patient_full_name",
        DOB: "patient_dob",
        PrimaryPhone: "patient_phone",
      },
    ),
  },
  {
    id: "one_call_template",
    name: "one_call_template",
    displayName: "one_call_template",
    fields: createFields(
      "FirstName-LastName-TripDate-PickupAddress-PickupCity-PickupZip-DropoffAddress-DropoffCity-DropoffZip-PickupTime",
      {
        FirstName: "patient_first_name",
        LastName: "patient_last_name",
        TripDate: "trip_date",
        PickupAddress: "pickup_address",
        PickupCity: "pickup_city",
        PickupZip: "pickup_zip",
        DropoffAddress: "dropoff_address",
        DropoffCity: "dropoff_city",
        DropoffZip: "dropoff_zip",
        PickupTime: "pickup_time",
      },
    ),
  },
  {
    id: "one_call_wc_template",
    name: "one_call_wc_template",
    displayName: "one_call_wc_template",
    fields: createFields(
      "Order ID-Assignment ID-Claimant's First Name-Claimant's Last Name-Claimant's Ph Number-Scheduled Pick-up Date-Scheduled Pick-up Time-Appointment Date-Appointment Time-Pickup Address Name-From Address-From City-From State-From Zip Code-Dropoff Address Name-To Address-To City-To State-To Zip Code-Distance-Notes to Driver",
      {
        "Order ID": "trip_id",
        "Claimant's First Name": "patient_first_name",
        "Claimant's Last Name": "patient_last_name",
        "Claimant's Ph Number": "patient_phone",
        "Scheduled Pick-up Date": "trip_date",
        "Scheduled Pick-up Time": "pickup_time",
        "Appointment Date": "appointment_time",
        "From Address": "pickup_address",
        "To Address": "dropoff_address",
        "From City": "pickup_city",
        "To City": "dropoff_city",
        "From Zip Code": "pickup_zip",
        "To Zip Code": "dropoff_zip",
        Distance: "distance_miles",
        "Notes to Driver": "notes",
      },
    ),
  },
  {
    id: "pace_template",
    name: "pace_template",
    displayName: "pace_template",
    fields: createFields(
      "ClientName-Origin street-Origin City-Dest Street-Dest city-Sched Time-Appt Time",
      {
        ClientName: "patient_full_name",
        "Origin street": "pickup_address",
        "Origin City": "pickup_city",
        "Dest Street": "dropoff_address",
        "Dest city": "dropoff_city",
        "Sched Time": "pickup_time",
        "Appt Time": "appointment_time",
      },
    ),
  },
  {
    id: "priority_health_template",
    name: "priority_health_template",
    displayName: "priority_health_template",
    fields: createFields(
      "Member First Name-Member Last Name-DOB-Member Phone Number-Pickup Address-Pickup City-Pickup State-Pickup Zip-Appointment Date and Time",
      {
        "Member First Name": "patient_first_name",
        "Member Last Name": "patient_last_name",
        DOB: "patient_dob",
        "Member Phone Number": "patient_phone",
        "Pickup Address": "pickup_address",
        "Pickup City": "pickup_city",
        "Pickup State": "pickup_state",
        "Pickup Zip": "pickup_zip",
        "Appointment Date and Time": "appointment_time",
      },
    ),
  },
  {
    id: "provide_a_ride_template",
    name: "provide_a_ride_template",
    displayName: "provide_a_ride_template",
    fields: createFields(
      "Date-Name-Phone Number-Earliest Pickup-Latest Pickup-org. Street 1-org. City-org. Zip Code-dst. Street 1-dst. City-dst. Zip Code-Miles",
      {
        Date: "trip_date",
        Name: "patient_full_name",
        "Phone Number": "patient_phone",
        "Earliest Pickup": "pickup_time",
        "org. Street 1": "pickup_address",
        "org. City": "pickup_city",
        "org. Zip Code": "pickup_zip",
        "dst. Street 1": "dropoff_address",
        "dst. City": "dropoff_city",
        "dst. Zip Code": "dropoff_zip",
        Miles: "distance_miles",
      },
    ),
  },
  {
    id: "ride_2_md_template",
    name: "ride_2_md_template",
    displayName: "ride_2_md_template",
    fields: createFields(
      "Check Provider Reservation Validation messages Error Company Vehicle Code Provider Status Status Special Req Service Animal Driver Driver Phone Rider Phone Age Rider Id Payor Depot Service R. For Transport Date Leg Appointment PU Time ActualPU Address City ZipCode Phone Geo County Actual Drop Address Actual Drop City ZipCode Phone Geo County Loaded Miles Authorization Companions VIP Confirmed SO",
      {
        "Rider Phone": "patient_phone",
        "Transport Date": "trip_date",
        Appointment: "appointment_time",
        "PU Time": "pickup_time",
        Address: "pickup_address",
        City: "pickup_city",
        ZipCode: "pickup_zip",
        "Actual Drop Address": "dropoff_address",
        "Actual Drop City": "dropoff_city",
        "Loaded Miles": "distance_miles",
      },
    ),
  },
  {
    id: "ride_2_md_update_template_ZPcwMym",
    name: "ride_2_md_update_template_ZPcwMym",
    displayName: "ride_2_md_update_template_ZPcwMym",
    fields: createFields(
      "Rider Phone PU DOB Age Rider Id Payor Pref. Prov. Service R. For Transport Date Leg Appointment Act Time PU Time ActualPU Address City State ZipCode Pick-Up Location Latitude Longitud Phone Alternate Phone Home Phone Geo County Apt/Ste/Rm Actual Drop Address Actual Drop City State ZipCode Drop-Off Location Latitude Longitud Phone Alternate Phone Home Phone Geo County Apt/Ste/Rm Loaded Miles Authorization",
      {
        "Rider Phone": "patient_phone",
        "Transport Date": "trip_date",
        Appointment: "appointment_time",
        "PU Time": "pickup_time",
        Address: "pickup_address",
        City: "pickup_city",
        ZipCode: "pickup_zip",
        "Actual Drop Address": "dropoff_address",
        "Actual Drop City": "dropoff_city",
        "Loaded Miles": "distance_miles",
      },
    ),
  },
  {
    id: "ride_to_care_template",
    name: "ride_to_care_template",
    displayName: "ride_to_care_template",
    fields: createFields(
      "First Name-Last Name-Trip Date-Promised Pick-up Time-Pick-up Street-Pick-up City-Pick-up ZIP-Drop-off Street-Drop-off City-Drop-off ZIP-Passenger Phone",
      {
        "First Name": "patient_first_name",
        "Last Name": "patient_last_name",
        "Trip Date": "trip_date",
        "Promised Pick-up Time": "pickup_time",
        "Pick-up Street": "pickup_address",
        "Pick-up City": "pickup_city",
        "Pick-up ZIP": "pickup_zip",
        "Drop-off Street": "dropoff_address",
        "Drop-off City": "dropoff_city",
        "Drop-off ZIP": "dropoff_zip",
        "Passenger Phone": "patient_phone",
      },
    ),
  },
  {
    id: "route_genie_template",
    name: "route_genie_template",
    displayName: "route_genie_template",
    fields: createFields(
      "Passenger DOB-Passenger First Name-Passenger Last Name-Phone Number-PU Address-DO Address-Date of service-Appointment time-Pick up time",
      {
        "Passenger DOB": "patient_dob",
        "Passenger First Name": "patient_first_name",
        "Passenger Last Name": "patient_last_name",
        "Phone Number": "patient_phone",
        "PU Address": "pickup_address",
        "DO Address": "dropoff_address",
        "Date of service": "trip_date",
        "Appointment time": "appointment_time",
        "Pick up time": "pickup_time",
      },
    ),
  },
  {
    id: "safe_ride_health_template",
    name: "safe_ride_health_template",
    displayName: "safe_ride_health_template",
    fields: createFields(
      "patientFirstName-patientLastName-dateOfBirth-patientPhoneNumber-pickupTime-appointmentTime-fromAddress-toAddress",
      {
        patientFirstName: "patient_first_name",
        patientLastName: "patient_last_name",
        dateOfBirth: "patient_dob",
        patientPhoneNumber: "patient_phone",
        pickupTime: "pickup_time",
        appointmentTime: "appointment_time",
        fromAddress: "pickup_address",
        toAddress: "dropoff_address",
      },
    ),
  },
  {
    id: "safe_ride_template",
    name: "safe_ride_template",
    displayName: "safe_ride_template",
    fields: createFields(
      "MemberName-PickUpTime-PickUpStreet-DropOffStreet-Miles-TripID",
      {
        MemberName: "patient_full_name",
        PickUpTime: "pickup_time",
        PickUpStreet: "pickup_address",
        DropOffStreet: "dropoff_address",
        Miles: "distance_miles",
        TripID: "trip_id",
      },
    ),
  },
  {
    id: "sms_template",
    name: "sms_template",
    displayName: "sms_template",
    fields: createFields(
      "Appt Date-Appt Time-Origin Address-Origin City-Destination Address-Destination City-Passenger Name",
      {
        "Appt Date": "trip_date",
        "Appt Time": "appointment_time",
        "Origin Address": "pickup_address",
        "Origin City": "pickup_city",
        "Destination Address": "dropoff_address",
        "Destination City": "dropoff_city",
        "Passenger Name": "patient_full_name",
      },
    ),
  },
  {
    id: "south_east_trans_template",
    name: "south_east_trans_template",
    displayName: "south_east_trans_template",
    fields: createFields(
      "MemberName-PickUpTime-PickUpStreet-DropOffStreet-Miles-TripID",
      {
        MemberName: "patient_full_name",
        PickUpTime: "pickup_time",
        PickUpStreet: "pickup_address",
        DropOffStreet: "dropoff_address",
        Miles: "distance_miles",
        TripID: "trip_id",
      },
    ),
  },
  {
    id: "tennesse_template",
    name: "tennesse_template",
    displayName: "tennesse_template",
    fields: createFields(
      "MemberName-PickUpTime-PickUpStreet-DropOffStreet-Miles-DateOfBirth",
      {
        MemberName: "patient_full_name",
        PickUpTime: "pickup_time",
        PickUpStreet: "pickup_address",
        DropOffStreet: "dropoff_address",
        Miles: "distance_miles",
        DateOfBirth: "patient_dob",
      },
    ),
  },
  {
    id: "transcita_template_rStdQGa",
    name: "transcita_template_rStdQGa",
    displayName: "transcita_template_rStdQGa",
    fields: createFields(
      "FirstName-LastName-BirthDate-MobilePhone-Payer-PU address-DO address-PU Date-Pick-Up-Appt Time-Notes",
      {
        FirstName: "patient_first_name",
        LastName: "patient_last_name",
        BirthDate: "patient_dob",
        MobilePhone: "patient_phone",
        "PU address": "pickup_address",
        "DO address": "dropoff_address",
        "PU Date": "trip_date",
        "Pick-Up": "pickup_time",
        "Appt Time": "appointment_time",
        Notes: "notes",
      },
    ),
  },
  {
    id: "transdev_template",
    name: "transdev_template",
    displayName: "transdev_template",
    fields: createFields(
      "First Name-Last Name-Date of Birth-Trip Date-Promised Pick-up Time-Pick-up Street-Pick-up City-Pick-up ZIP-Drop-off Street-Drop-off City-Drop-off ZIP",
      {
        "First Name": "patient_first_name",
        "Last Name": "patient_last_name",
        "Date of Birth": "patient_dob",
        "Trip Date": "trip_date",
        "Promised Pick-up Time": "pickup_time",
        "Pick-up Street": "pickup_address",
        "Pick-up City": "pickup_city",
        "Pick-up ZIP": "pickup_zip",
        "Drop-off Street": "dropoff_address",
        "Drop-off City": "dropoff_city",
        "Drop-off ZIP": "dropoff_zip",
      },
    ),
  },
  {
    id: "va_template",
    name: "va_template",
    displayName: "va_template",
    fields: createFields(
      "Trip-Date&Time-Pick-up Address-Drop-off address-Est Cost-Est Distance",
      {
        "Date&Time": "pickup_time",
        "Pick-up Address": "pickup_address",
        "Drop-off address": "dropoff_address",
        "Est Distance": "distance_miles",
      },
    ),
  },
  {
    id: "vamc_template_hFqo1K4",
    name: "vamc_template_hFqo1K4",
    displayName: "vamc_template_hFqo1K4",
    fields: createFields(
      "Pickup Date-Pick Up Time-Patient Name-Address-Destination-Phone Number",
      {
        "Pickup Date": "trip_date",
        "Pick Up Time": "pickup_time",
        "Patient Name": "patient_full_name",
        Address: "pickup_address",
        Destination: "dropoff_address",
        "Phone Number": "patient_phone",
      },
    ),
  },
  {
    id: "vet_ride_template",
    name: "vet_ride_template",
    displayName: "vet_ride_template",
    fields: createFields(
      "Trip ID-Passenger-Phone Number-Estimated Pickup Time-Appointment Time-Pickup Address-Dropoff Address-Estimated Distance",
      {
        "Trip ID": "trip_id",
        Passenger: "patient_full_name",
        "Phone Number": "patient_phone",
        "Estimated Pickup Time": "pickup_time",
        "Appointment Time": "appointment_time",
        "Pickup Address": "pickup_address",
        "Dropoff Address": "dropoff_address",
        "Estimated Distance": "distance_miles",
      },
    ),
  },
  {
    id: "veyo_template",
    name: "veyo_template",
    displayName: "veyo_template",
    fields: createFields(
      "Member Name-Scheduled Pickup Date-Pickup Address-Drop-off Address-Phone Number-Miles",
      {
        "Member Name": "patient_full_name",
        "Scheduled Pickup Date": "trip_date",
        "Pickup Address": "pickup_address",
        "Drop-off Address": "dropoff_address",
        "Phone Number": "patient_phone",
        Miles: "distance_miles",
      },
    ),
  },
  {
    id: "veyo_v2_template",
    name: "veyo_v2_template",
    displayName: "veyo_v2_template",
    fields: createFields(
      "Member Name-Scheduled Pickup Date-Pickup Address-Drop-off Address-Phone Number-Miles",
      {
        "Member Name": "patient_full_name",
        "Scheduled Pickup Date": "trip_date",
        "Pickup Address": "pickup_address",
        "Drop-off Address": "dropoff_address",
        "Phone Number": "patient_phone",
        Miles: "distance_miles",
      },
    ),
  },
  {
    id: "future_nemt_template",
    name: "future_nemt_template",
    displayName: "future_nemt_transportation_template",
    fields: [
      {
        name: "Patient First Name",
        required: true,
        mapTo: "patient_first_name",
      },
      { name: "Patient Last Name", required: true, mapTo: "patient_last_name" },
      { name: "Patient Phone", required: false, mapTo: "patient_phone" },
      { name: "Patient DOB", required: false, mapTo: "patient_dob" },
      { name: "Pickup Address", required: true, mapTo: "pickup_address" },
      { name: "Pickup City", required: false, mapTo: "pickup_city" },
      { name: "Pickup State", required: false, mapTo: "pickup_state" },
      { name: "Pickup Zip", required: false, mapTo: "pickup_zip" },
      { name: "Dropoff Address", required: true, mapTo: "dropoff_address" },
      { name: "Dropoff City", required: false, mapTo: "dropoff_city" },
      { name: "Dropoff State", required: false, mapTo: "dropoff_state" },
      { name: "Dropoff Zip", required: false, mapTo: "dropoff_zip" },
      { name: "Trip Date", required: true, mapTo: "trip_date" },
      { name: "Pickup Time", required: false, mapTo: "pickup_time" },
      { name: "Appointment Time", required: false, mapTo: "appointment_time" },
      { name: "Trip Type", required: false, mapTo: "trip_type" },
      { name: "Distance (Miles)", required: false, mapTo: "distance_miles" },
      {
        name: "Duration (Minutes)",
        required: false,
        mapTo: "duration_minutes",
      },
      { name: "Notes", required: false, mapTo: "notes" },
    ],
  },
];

/**
 * Get a template by its ID
 */
export function getTemplateById(id: string): BrokerTemplate | undefined {
  return BROKER_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get template field names
 */
export function getTemplateFieldNames(templateId: string): string[] {
  const template = getTemplateById(templateId);
  return template ? template.fields.map((f) => f.name) : [];
}
