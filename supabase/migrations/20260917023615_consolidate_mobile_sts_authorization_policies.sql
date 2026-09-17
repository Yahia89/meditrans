-- Equivalent manager-or-own-driver authorization in one policy per action.
-- Avoid duplicate permissive policy evaluation without widening any grants.
ALTER POLICY compliance_sts_read ON public.driver_sts_inspections
 USING(private.can_manage_compliance_documents(org_id)
  OR (source='mobile_app' AND private.owns_active_inspection_driver(org_id,driver_id)));
ALTER POLICY compliance_sts_insert ON public.driver_sts_inspections
 WITH CHECK(private.can_manage_compliance_documents(org_id)
  OR (source='mobile_app' AND private.is_driver_inspection_rpc(id,org_id,driver_id,source_record_id)));
ALTER POLICY compliance_sts_update ON public.driver_sts_inspections
 USING(private.can_manage_compliance_documents(org_id)
  OR (source='mobile_app' AND private.owns_active_inspection_driver(org_id,driver_id)))
 WITH CHECK(private.can_manage_compliance_documents(org_id)
  OR (source='mobile_app' AND private.is_driver_inspection_rpc(id,org_id,driver_id,source_record_id)));
DROP POLICY compliance_sts_driver_read ON public.driver_sts_inspections;
DROP POLICY compliance_sts_driver_rpc_insert ON public.driver_sts_inspections;
DROP POLICY compliance_sts_driver_rpc_update ON public.driver_sts_inspections;
