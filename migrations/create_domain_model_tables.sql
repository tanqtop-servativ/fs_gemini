-- Migration: Servativ Pro Domain Model Tables
-- Purpose: Add immutable visit/artifact tracking per domain invariants
-- Date: 2024-12-08

-- ============================================================================
-- SHARED IMMUTABILITY FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Table % is immutable. UPDATE and DELETE operations are not permitted.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. VISITS - Real-world attempts at a Job
-- ============================================================================

CREATE TABLE IF NOT EXISTS visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    visit_number INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'Scheduled'
        CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Incomplete', 'Aborted')),
    scheduled_start TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(job_id, visit_number)
);

ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_visits_job_id ON visits(job_id);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);

-- Terminal state protection (visits can transition until terminal)
CREATE OR REPLACE FUNCTION visits_terminal_protection()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IN ('Completed', 'Incomplete', 'Aborted') THEN
        RAISE EXCEPTION 'Visit in terminal state (%) cannot be modified', OLD.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS visits_terminal_check ON visits;
CREATE TRIGGER visits_terminal_check
    BEFORE UPDATE ON visits FOR EACH ROW
    EXECUTE FUNCTION visits_terminal_protection();

-- RLS Policy
DROP POLICY IF EXISTS "visits_tenant_isolation" ON visits;
CREATE POLICY "visits_tenant_isolation" ON visits
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM jobs j 
            WHERE j.id = visits.job_id 
            AND j.tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        )
    );

-- ============================================================================
-- 2. WORKER_VISIT_LOGS - GPS-backed status history (IMMUTABLE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS worker_visit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id),
    status TEXT NOT NULL 
        CHECK (status IN ('On My Way', 'Started', 'Paused', 'Finished', 'No-show')),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    latitude NUMERIC,
    longitude NUMERIC,
    device_info JSONB
);

ALTER TABLE worker_visit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_worker_visit_logs_visit_id ON worker_visit_logs(visit_id);
CREATE INDEX IF NOT EXISTS idx_worker_visit_logs_person_id ON worker_visit_logs(person_id);

DROP TRIGGER IF EXISTS worker_visit_logs_immutable ON worker_visit_logs;
CREATE TRIGGER worker_visit_logs_immutable
    BEFORE UPDATE OR DELETE ON worker_visit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_mutation();

-- RLS Policy
DROP POLICY IF EXISTS "worker_visit_logs_tenant_isolation" ON worker_visit_logs;
CREATE POLICY "worker_visit_logs_tenant_isolation" ON worker_visit_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM visits v
            JOIN jobs j ON j.id = v.job_id
            WHERE v.id = worker_visit_logs.visit_id
            AND j.tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        )
    );

-- ============================================================================
-- 3. ARTIFACTS - Immutable attestation records (IMMUTABLE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    visit_id UUID REFERENCES visits(id),
    job_id UUID REFERENCES jobs(id),
    artifact_type TEXT NOT NULL,
    
    -- Attestation binding
    submitted_by UUID NOT NULL REFERENCES people(id),
    submitted_as_role UUID NOT NULL REFERENCES roles(id),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Content
    payload JSONB NOT NULL,
    
    -- Correction chain
    corrects_artifact_id UUID REFERENCES artifacts(id),
    invalidated_by_artifact_id UUID REFERENCES artifacts(id)
);

ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_artifacts_job_id ON artifacts(job_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_visit_id ON artifacts(visit_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(artifact_type);
CREATE INDEX IF NOT EXISTS idx_artifacts_corrects ON artifacts(corrects_artifact_id) WHERE corrects_artifact_id IS NOT NULL;

DROP TRIGGER IF EXISTS artifacts_immutable ON artifacts;
CREATE TRIGGER artifacts_immutable
    BEFORE UPDATE OR DELETE ON artifacts
    FOR EACH ROW EXECUTE FUNCTION prevent_mutation();

-- RLS Policy
DROP POLICY IF EXISTS "artifacts_tenant_isolation" ON artifacts;
CREATE POLICY "artifacts_tenant_isolation" ON artifacts
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    );

-- ============================================================================
-- 4. BOM_SNAPSHOTS - Frozen at job creation (IMMUTABLE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bom_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bom_snapshots ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_bom_snapshots_job_id ON bom_snapshots(job_id);

DROP TRIGGER IF EXISTS bom_snapshots_immutable ON bom_snapshots;
CREATE TRIGGER bom_snapshots_immutable
    BEFORE UPDATE OR DELETE ON bom_snapshots
    FOR EACH ROW EXECUTE FUNCTION prevent_mutation();

-- RLS Policy
DROP POLICY IF EXISTS "bom_snapshots_tenant_isolation" ON bom_snapshots;
CREATE POLICY "bom_snapshots_tenant_isolation" ON bom_snapshots
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM jobs j 
            WHERE j.id = bom_snapshots.job_id 
            AND j.tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        )
    );

-- ============================================================================
-- 5. JOB_DISPOSITIONS - Immutable cancellation records (IMMUTABLE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_dispositions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    disposition_type TEXT NOT NULL 
        CHECK (disposition_type IN ('cancelled', 'not_required', 'deferred')),
    reason TEXT NOT NULL,
    disposed_by UUID NOT NULL REFERENCES people(id),
    disposed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE job_dispositions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_job_dispositions_job_id ON job_dispositions(job_id);

DROP TRIGGER IF EXISTS job_dispositions_immutable ON job_dispositions;
CREATE TRIGGER job_dispositions_immutable
    BEFORE UPDATE OR DELETE ON job_dispositions
    FOR EACH ROW EXECUTE FUNCTION prevent_mutation();

-- RLS Policy
DROP POLICY IF EXISTS "job_dispositions_tenant_isolation" ON job_dispositions;
CREATE POLICY "job_dispositions_tenant_isolation" ON job_dispositions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM jobs j 
            WHERE j.id = job_dispositions.job_id 
            AND j.tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        )
    );

-- ============================================================================
-- 6. SERVICE_AMENDMENTS - Audit trail of job changes (IMMUTABLE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_amendments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_opportunity_id UUID NOT NULL REFERENCES service_opportunities(id) ON DELETE CASCADE,
    amendment_type TEXT NOT NULL 
        CHECK (amendment_type IN ('job_added', 'job_removed')),
    job_id UUID REFERENCES jobs(id),
    reason TEXT NOT NULL,
    amended_by UUID NOT NULL REFERENCES people(id),
    amended_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE service_amendments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_service_amendments_opp_id ON service_amendments(service_opportunity_id);

DROP TRIGGER IF EXISTS service_amendments_immutable ON service_amendments;
CREATE TRIGGER service_amendments_immutable
    BEFORE UPDATE OR DELETE ON service_amendments
    FOR EACH ROW EXECUTE FUNCTION prevent_mutation();

-- RLS Policy
DROP POLICY IF EXISTS "service_amendments_tenant_isolation" ON service_amendments;
CREATE POLICY "service_amendments_tenant_isolation" ON service_amendments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM service_opportunities so 
            WHERE so.id = service_amendments.service_opportunity_id 
            AND so.tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        )
    );

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT ON visits TO authenticated;
GRANT UPDATE (status, actual_start, actual_end) ON visits TO authenticated;
GRANT SELECT, INSERT ON worker_visit_logs TO authenticated;
GRANT SELECT, INSERT ON artifacts TO authenticated;
GRANT SELECT, INSERT ON bom_snapshots TO authenticated;
GRANT SELECT, INSERT ON job_dispositions TO authenticated;
GRANT SELECT, INSERT ON service_amendments TO authenticated;
