/**
 * useWorkerStatus composable
 * Handles worker status logging and artifact submission
 */
import { supabase } from '../lib/supabase'

export function useWorkerStatus() {

    /**
     * Log worker status for a visit
     * @param {string} visitId
     * @param {string} status - 'On My Way' | 'Started' | 'Paused' | 'Finished' | 'No-show'
     * @param {Object} [location] - { latitude, longitude }
     * @param {Object} [deviceInfo] - Device metadata
     * @returns {Promise<{success: boolean, logId?: string, error?: string}>}
     */
    const logStatus = async (visitId, status, location = null, deviceInfo = null) => {
        const { data, error } = await supabase.rpc('log_worker_status', {
            p_visit_id: visitId,
            p_status: status,
            p_latitude: location?.latitude || null,
            p_longitude: location?.longitude || null,
            p_device_info: deviceInfo || null
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, logId: data }
    }

    /**
     * Submit completion artifact
     * @param {string} visitId
     * @param {string} jobId
     * @param {Object} payload - Artifact content
     * @returns {Promise<{success: boolean, artifactId?: string, error?: string}>}
     */
    const submitCompletion = async (visitId, jobId, payload) => {
        const { data, error } = await supabase.rpc('submit_artifact', {
            p_visit_id: visitId,
            p_job_id: jobId,
            p_artifact_type: 'CompletionArtifact',
            p_payload: payload
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, artifactId: data }
    }

    /**
     * Submit incompletion artifact
     * @param {string} visitId
     * @param {string} jobId
     * @param {Object} payload - Incompletion details
     * @returns {Promise<{success: boolean, artifactId?: string, error?: string}>}
     */
    const submitIncompletion = async (visitId, jobId, payload) => {
        const { data, error } = await supabase.rpc('submit_artifact', {
            p_visit_id: visitId,
            p_job_id: jobId,
            p_artifact_type: 'IncompletionArtifact',
            p_payload: payload
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, artifactId: data }
    }

    /**
     * Submit correction artifact
     * @param {string} visitId
     * @param {string} jobId
     * @param {Object} payload - Correction details
     * @param {string} correctsArtifactId - ID of artifact being corrected
     * @returns {Promise<{success: boolean, artifactId?: string, error?: string}>}
     */
    const submitCorrection = async (visitId, jobId, payload, correctsArtifactId) => {
        const { data, error } = await supabase.rpc('submit_artifact', {
            p_visit_id: visitId,
            p_job_id: jobId,
            p_artifact_type: 'CorrectionArtifact',
            p_payload: payload,
            p_corrects_artifact_id: correctsArtifactId
        })

        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true, artifactId: data }
    }

    /**
     * Get current location
     * @returns {Promise<{latitude: number, longitude: number} | null>}
     */
    const getCurrentLocation = () => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null)
                return
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    })
                },
                () => {
                    resolve(null)
                },
                { timeout: 5000, enableHighAccuracy: true }
            )
        })
    }

    /**
     * Status button configurations
     */
    const statusButtons = [
        { status: 'On My Way', label: 'On My Way', labelEs: 'En Camino', icon: 'navigation', color: 'blue' },
        { status: 'Started', label: 'Start', labelEs: 'Iniciar', icon: 'play', color: 'green' },
        { status: 'Paused', label: 'Pause', labelEs: 'Pausar', icon: 'pause', color: 'amber' },
        { status: 'Finished', label: 'Finish', labelEs: 'Terminar', icon: 'check', color: 'emerald' }
    ]

    return {
        logStatus,
        submitCompletion,
        submitIncompletion,
        submitCorrection,
        getCurrentLocation,
        statusButtons
    }
}
