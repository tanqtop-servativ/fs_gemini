-- Migration: Analytics Functions
-- Purpose: Worker integrity scoring and failure analysis
-- Date: 2024-12-08

-- ============================================================================
-- WORKER INTEGRITY SCORE
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_worker_integrity_score(p_person_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_total_visits INT;
    v_no_shows INT;
    v_honest_incompletions INT;
    v_corrections_received INT;
    v_completions INT;
    v_integrity_score NUMERIC;
BEGIN
    -- Count metrics over last 90 days
    WITH worker_stats AS (
        SELECT 
            COUNT(DISTINCT wvl.visit_id) AS total_visits,
            COUNT(*) FILTER (WHERE wvl.status = 'No-show') AS no_shows
        FROM worker_visit_logs wvl
        WHERE wvl.person_id = p_person_id
          AND wvl.recorded_at > now() - interval '90 days'
    ),
    artifact_stats AS (
        SELECT
            COUNT(*) FILTER (WHERE a.artifact_type = 'IncompletionArtifact') AS honest_incompletions,
            COUNT(*) FILTER (WHERE a.artifact_type = 'CompletionArtifact') AS completions,
            COUNT(*) FILTER (WHERE a2.id IS NOT NULL) AS corrections_received
        FROM artifacts a
        LEFT JOIN artifacts a2 ON a2.corrects_artifact_id = a.id AND a2.submitted_by != p_person_id
        WHERE a.submitted_by = p_person_id
          AND a.submitted_at > now() - interval '90 days'
    )
    SELECT 
        ws.total_visits,
        ws.no_shows,
        ast.honest_incompletions,
        ast.completions,
        ast.corrections_received
    INTO v_total_visits, v_no_shows, v_honest_incompletions, v_completions, v_corrections_received
    FROM worker_stats ws, artifact_stats ast;
    
    -- Calculate integrity score (0-100)
    -- Start at 100, deduct for issues, add for good behavior
    v_integrity_score := 100;
    
    -- Deduct for no-shows (max -30)
    IF v_total_visits > 0 THEN
        v_integrity_score := v_integrity_score - LEAST(30, (v_no_shows::numeric / v_total_visits * 100));
    END IF;
    
    -- Add for honest incompletions (max +20)
    IF (v_completions + v_honest_incompletions) > 0 THEN
        v_integrity_score := v_integrity_score + LEAST(20, (v_honest_incompletions::numeric / (v_completions + v_honest_incompletions) * 40));
    END IF;
    
    -- Deduct for corrections received (max -15)
    IF v_completions > 0 THEN
        v_integrity_score := v_integrity_score - LEAST(15, (v_corrections_received::numeric / v_completions * 50));
    END IF;
    
    -- Clamp to 0-100
    v_integrity_score := GREATEST(0, LEAST(100, v_integrity_score));
    
    RETURN jsonb_build_object(
        'person_id', p_person_id,
        'period_days', 90,
        'total_visits', v_total_visits,
        'no_shows', v_no_shows,
        'no_show_rate', ROUND(COALESCE(v_no_shows::numeric / NULLIF(v_total_visits, 0) * 100, 0), 1),
        'completions', v_completions,
        'honest_incompletions', v_honest_incompletions,
        'corrections_received', v_corrections_received,
        'correction_rate', ROUND(COALESCE(v_corrections_received::numeric / NULLIF(v_completions, 0) * 100, 0), 1),
        'integrity_score', ROUND(v_integrity_score, 1)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION calculate_worker_integrity_score(UUID) TO authenticated;

-- ============================================================================
-- FAILURE CLASSIFICATION ANALYSIS
-- ============================================================================

CREATE OR REPLACE FUNCTION analyze_failure_patterns(p_tenant_id UUID, p_days INT DEFAULT 90)
RETURNS TABLE (
    reason_code TEXT,
    total_count BIGINT,
    unique_workers BIGINT,
    unique_properties BIGINT,
    failure_type TEXT,
    recommendation TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH failure_stats AS (
        SELECT 
            a.payload->>'reason_code' AS reason,
            a.submitted_by AS worker_id,
            j.property_id
        FROM artifacts a
        JOIN jobs j ON j.id = a.job_id
        WHERE a.artifact_type = 'IncompletionArtifact'
          AND a.tenant_id = p_tenant_id
          AND a.submitted_at > now() - (p_days || ' days')::interval
    )
    SELECT 
        fs.reason AS reason_code,
        COUNT(*)::bigint AS total_count,
        COUNT(DISTINCT fs.worker_id)::bigint AS unique_workers,
        COUNT(DISTINCT fs.property_id)::bigint AS unique_properties,
        CASE 
            WHEN COUNT(DISTINCT fs.worker_id) = 1 AND COUNT(*) >= 3 THEN 'HUMAN'
            WHEN COUNT(DISTINCT fs.property_id) = 1 AND COUNT(*) >= 3 THEN 'PROPERTY'
            WHEN COUNT(DISTINCT fs.worker_id) >= 3 AND COUNT(DISTINCT fs.property_id) >= 3 THEN 'PROCESS'
            ELSE 'ISOLATED'
        END AS failure_type,
        CASE 
            WHEN COUNT(DISTINCT fs.worker_id) = 1 AND COUNT(*) >= 3 THEN 'Review worker training'
            WHEN COUNT(DISTINCT fs.property_id) = 1 AND COUNT(*) >= 3 THEN 'Investigate property-specific issues'
            WHEN COUNT(DISTINCT fs.worker_id) >= 3 AND COUNT(DISTINCT fs.property_id) >= 3 THEN 'Review process/supply chain'
            ELSE 'Monitor for patterns'
        END AS recommendation
    FROM failure_stats fs
    WHERE fs.reason IS NOT NULL
    GROUP BY fs.reason
    HAVING COUNT(*) >= 2
    ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION analyze_failure_patterns(UUID, INT) TO authenticated;

-- ============================================================================
-- MULTI-VISIT JOB ANALYSIS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_retry_analysis(p_tenant_id UUID, p_days INT DEFAULT 90)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    WITH job_visits AS (
        SELECT 
            j.id AS job_id,
            j.title AS job_type,
            COUNT(v.id) AS visit_count
        FROM jobs j
        JOIN visits v ON v.job_id = j.id
        WHERE j.tenant_id = p_tenant_id
          AND j.created_at > now() - (p_days || ' days')::interval
        GROUP BY j.id, j.title
    )
    SELECT jsonb_build_object(
        'period_days', p_days,
        'total_jobs', COUNT(*),
        'single_visit_jobs', COUNT(*) FILTER (WHERE visit_count = 1),
        'multi_visit_jobs', COUNT(*) FILTER (WHERE visit_count > 1),
        'first_attempt_success_rate', ROUND(
            COUNT(*) FILTER (WHERE visit_count = 1)::numeric / NULLIF(COUNT(*), 0) * 100
        , 1),
        'by_job_type', (
            SELECT jsonb_agg(jsonb_build_object(
                'job_type', job_type,
                'total', total,
                'multi_visit', multi,
                'retry_rate', ROUND(multi::numeric / NULLIF(total, 0) * 100, 1)
            ))
            FROM (
                SELECT 
                    job_type,
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE visit_count > 1) AS multi
                FROM job_visits
                GROUP BY job_type
            ) sub
        ),
        'avg_visits_per_job', ROUND(AVG(visit_count), 2)
    ) INTO v_result
    FROM job_visits;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_retry_analysis(UUID, INT) TO authenticated;

-- ============================================================================
-- CORRECTION PATTERN ANALYSIS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_correction_analysis(p_tenant_id UUID, p_days INT DEFAULT 90)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_by_job_type JSONB;
    v_total_completions BIGINT;
    v_total_corrections BIGINT;
BEGIN
    -- Get totals first
    SELECT 
        COUNT(*) FILTER (WHERE artifact_type = 'CompletionArtifact'),
        COUNT(*) FILTER (WHERE corrects_artifact_id IS NOT NULL)
    INTO v_total_completions, v_total_corrections
    FROM artifacts
    WHERE tenant_id = p_tenant_id
      AND submitted_at > now() - (p_days || ' days')::interval;

    -- Get by_job_type separately
    SELECT jsonb_agg(jsonb_build_object(
        'job_type', job_title,
        'completions', completions,
        'corrections', corrections,
        'rate', ROUND(corrections::numeric / NULLIF(completions, 0) * 100, 1)
    ))
    INTO v_by_job_type
    FROM (
        SELECT 
            j.title AS job_title,
            COUNT(*) FILTER (WHERE a2.artifact_type = 'CompletionArtifact') AS completions,
            COUNT(*) FILTER (WHERE a2.corrects_artifact_id IS NOT NULL) AS corrections
        FROM artifacts a2
        JOIN jobs j ON j.id = a2.job_id
        WHERE a2.tenant_id = p_tenant_id
          AND a2.submitted_at > now() - (p_days || ' days')::interval
        GROUP BY j.title
    ) sub;

    -- Build final result
    v_result := jsonb_build_object(
        'period_days', p_days,
        'total_completions', v_total_completions,
        'total_corrections', v_total_corrections,
        'correction_rate', ROUND(v_total_corrections::numeric / NULLIF(v_total_completions, 0) * 100, 1),
        'by_job_type', COALESCE(v_by_job_type, '[]'::jsonb)
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_correction_analysis(UUID, INT) TO authenticated;

-- ============================================================================
-- WORKER LEADERBOARD
-- ============================================================================

CREATE OR REPLACE FUNCTION get_worker_leaderboard(p_tenant_id UUID, p_days INT DEFAULT 90)
RETURNS TABLE (
    person_id UUID,
    person_name TEXT,
    total_visits BIGINT,
    completions BIGINT,
    incompletions BIGINT,
    no_shows BIGINT,
    integrity_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS person_id,
        p.first_name || ' ' || p.last_name AS person_name,
        COUNT(DISTINCT wvl.visit_id)::bigint AS total_visits,
        COUNT(DISTINCT a.id) FILTER (WHERE a.artifact_type = 'CompletionArtifact')::bigint AS completions,
        COUNT(DISTINCT a.id) FILTER (WHERE a.artifact_type = 'IncompletionArtifact')::bigint AS incompletions,
        COUNT(*) FILTER (WHERE wvl.status = 'No-show')::bigint AS no_shows,
        (calculate_worker_integrity_score(p.id)->>'integrity_score')::numeric AS integrity_score
    FROM people p
    LEFT JOIN worker_visit_logs wvl ON wvl.person_id = p.id 
        AND wvl.recorded_at > now() - (p_days || ' days')::interval
    LEFT JOIN visits v ON v.id = wvl.visit_id
    LEFT JOIN artifacts a ON a.visit_id = v.id AND a.submitted_by = p.id
    WHERE p.tenant_id = p_tenant_id
    GROUP BY p.id, p.first_name, p.last_name
    HAVING COUNT(DISTINCT wvl.visit_id) > 0
    ORDER BY integrity_score DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_worker_leaderboard(UUID, INT) TO authenticated;
