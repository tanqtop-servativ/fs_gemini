import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from './useAuth'
import { useJobs } from './useJobs'
import { useProperties } from './useProperties'
import { usePeople } from './usePeople'
import { useServiceOpportunities } from './useServiceOpportunities'

export function useCommandLine() {
    const router = useRouter()
    const { effectiveTenantId, userProfile, user } = useAuth()
    const { fetchJobs } = useJobs()
    const { listProperties } = useProperties()
    const { listPeople } = usePeople()
    const { fetchOpportunities } = useServiceOpportunities()

    // Restore from localStorage if available
    const savedHistory = localStorage.getItem('cli_history')
    const savedOutput = localStorage.getItem('cli_output')

    const commandHistory = ref(savedHistory ? JSON.parse(savedHistory) : [])
    const outputLines = ref(savedOutput ? JSON.parse(savedOutput) : [])
    const isProcessing = ref(false)

    // Cached data for searching
    const cachedJobs = ref([])
    const cachedProperties = ref([])
    const cachedPeople = ref([])
    const cachedOpportunities = ref([])

    // Navigation routes
    const routes = {
        'dashboard': '/',
        'home': '/',
        'calendar': '/calendar',
        'jobs': '/jobs',
        'properties': '/properties',
        'people': '/people',
        'staff': '/people',
        'users': '/people',
        'service-templates': '/service-templates',
        'job-templates': '/job-templates',
        'bom-templates': '/bom-templates',
        'bom': '/bom-templates',
        'service-opportunities': '/service-opportunities',
        'opps': '/service-opportunities',
        'analytics': '/analytics',
        'activity': '/activity',
        'admin': '/admin',
        'worker': '/worker',
        'power-user': '/power-user',
        'cli': '/power-user'
    }

    // Available commands for tab completion
    const commands = [
        'help', 'clear', 'cls', 'views', 'routes',
        'go', 'list', 'count', 'find', 'search',
        'refresh', 'reload', 'history', 'time', 'date',
        'whoami', 'echo', 'debug'
    ]

    // Entities for sub-completion
    const entities = ['jobs', 'properties', 'people', 'opps', 'all', 'staff', 'users']

    // Get tab completions based on current input
    const getCompletions = (input) => {
        const trimmed = input.trim().toLowerCase()
        const parts = trimmed.split(/\s+/)

        if (parts.length === 0 || (parts.length === 1 && !input.endsWith(' '))) {
            // Complete command or view name
            const partial = parts[0] || ''
            const allOptions = [...commands, ...Object.keys(routes)]
            return [...new Set(allOptions.filter(c => c.startsWith(partial)))]
        }

        const cmd = parts[0]

        // Complete second argument based on command type
        if (['go', 'g', 'nav', 'cd'].includes(cmd)) {
            const partial = parts[1] || ''
            return Object.keys(routes).filter(r => r.startsWith(partial))
        }

        if (['list', 'ls', 'show', 'count'].includes(cmd)) {
            const partial = parts[1] || ''
            return entities.filter(e => e.startsWith(partial))
        }

        if (['find', 'search'].includes(cmd)) {
            const partial = parts[1] || ''
            return ['job', 'property', 'person', 'opp'].filter(e => e.startsWith(partial))
        }

        return []
    }

    const aliases = {
        'j': 'jobs',
        'p': 'properties',
        'so': 'service-opportunities',
        'ls': 'list',
        'h': 'help',
        'find': 'search',
        's': 'search'
    }

    // Add an output line with optional styling
    // text can be a string OR an array of segments: { text, type, link }
    // Routes to addOutputInternal which respects redirect mode
    const addOutput = (text, type = 'normal') => {
        addOutputInternal(text, type)
    }

    // Clear terminal output
    const clearOutput = () => {
        outputLines.value = []
        commandHistory.value = []
        // Clear persisted state
        localStorage.removeItem('cli_history')
        localStorage.removeItem('cli_output')
        addOutput('Terminal cleared.', 'system')
    }

    // File download state
    let redirectBuffer = null
    let redirectFilename = null

    // Trigger browser file download
    const downloadFile = (filename, content) => {
        const blob = new Blob([content], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    // Structured data buffer for JSON/CSV exports
    let redirectData = null
    let redirectDataType = null  // 'jobs', 'properties', 'people', 'opps'

    // Convert array of objects to CSV string
    const toCSV = (data, entityType) => {
        if (!data || data.length === 0) return ''

        // Define columns per entity type for cleaner output
        const columnDefs = {
            jobs: ['id', 'status', 'property_name', 'template_name', 'scheduled_date', 'created_at'],
            properties: ['id', 'name', 'address', 'city', 'state', 'zip'],
            people: ['id', 'first_name', 'last_name', 'email', 'phone'],
            opps: ['id', 'workflow_status', 'property_name', 'service_template_name', 'due_date', 'created_at']
        }

        const columns = columnDefs[entityType] || Object.keys(data[0])
        const header = columns.join(',')

        const rows = data.map(item => {
            return columns.map(col => {
                let val = item[col]
                // Handle nested properties
                if (col === 'property_name' && !val) val = item.properties?.name || ''
                if (col === 'template_name' && !val) val = item.job_templates?.name || ''
                if (col === 'service_template_name' && !val) val = item.service_templates?.name || ''

                // Escape CSV values
                if (val === null || val === undefined) return ''
                const str = String(val)
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`
                }
                return str
            }).join(',')
        })

        return [header, ...rows].join('\n')
    }

    // Helper: Save to localStorage
    const saveToLocalStorage = () => {
        try {
            // Limit history to last 100 commands
            const historyToSave = commandHistory.value.slice(-100)
            // Limit output to last 200 lines
            const outputToSave = outputLines.value.slice(-200)

            localStorage.setItem('cli_history', JSON.stringify(historyToSave))
            localStorage.setItem('cli_output', JSON.stringify(outputToSave))
        } catch (e) {
            // Silently fail if localStorage is full
            console.warn('Failed to save CLI state:', e)
        }
    }

    // Add output - respects redirect mode
    const addOutputInternal = (text, type = 'normal') => {
        // If we're in redirect mode, capture to buffer instead
        if (redirectBuffer !== null) {
            // Extract plain text from segments
            if (Array.isArray(text)) {
                const line = text.map(seg => seg.text || '').join('')
                redirectBuffer.push(line)
            } else {
                redirectBuffer.push(text)
            }
            return
        }

        // Normal output to terminal
        outputLines.value.push({
            content: Array.isArray(text) ? text : [{ text, type }],
            timestamp: new Date()
        })

        // Save to localStorage after adding output
        saveToLocalStorage()
    }

    // Show help text
    const showHelp = () => {
        addOutput('╔══════════════════════════════════════════════════════════════╗', 'help')
        addOutput('║                    POWER USER CLI - HELP                     ║', 'help')
        addOutput('╠══════════════════════════════════════════════════════════════╣', 'help')
        addOutput('║  NAVIGATION                                                  ║', 'help')
        addOutput('║    go <view>         Navigate to a view                      ║', 'help')
        addOutput('║    g <view>          Short alias for go                      ║', 'help')
        addOutput('║    views             List available views                    ║', 'help')
        addOutput('║                                                              ║', 'help')
        addOutput('║  DATA COMMANDS                                               ║', 'help')
        addOutput('║    list jobs         Show recent jobs                        ║', 'help')
        addOutput('║    list properties   Show properties                         ║', 'help')
        addOutput('║    list people       Show staff/users                        ║', 'help')
        addOutput('║    list opps         Show service opportunities              ║', 'help')
        addOutput('║    count <entity>    Count entities                          ║', 'help')
        addOutput('║    refresh           Reload all data                         ║', 'help')
        addOutput('║                                                              ║', 'help')
        addOutput('║  SEARCH                                                      ║', 'help')
        addOutput('║    find job <query>        Search jobs                       ║', 'help')
        addOutput('║    find property <query>   Search properties                 ║', 'help')
        addOutput('║    find person <query>     Search people                     ║', 'help')
        addOutput('║                                                              ║', 'help')
        addOutput('║  UTILITIES                                                   ║', 'help')
        addOutput('║    clear / cls       Clear terminal                          ║', 'help')
        addOutput('║    help / ?          Show this help                          ║', 'help')
        addOutput('║    history           Show command history                    ║', 'help')
        addOutput('║    time              Show current time                       ║', 'help')
        addOutput('║                                                              ║', 'help')
        addOutput('║  FILE EXPORT                                                 ║', 'help')
        addOutput('║    <cmd> > file      Download output as file                 ║', 'help')
        addOutput('║    <cmd> | clipboard Copy output to clipboard                ║', 'help')
        addOutput('║    <cmd> | json      Copy as JSON to clipboard               ║', 'help')
        addOutput('║    <cmd> | csv       Copy as CSV to clipboard                ║', 'help')
        addOutput('║    Example: j | json                                         ║', 'help')
        addOutput('╚══════════════════════════════════════════════════════════════╝', 'help')
    }

    // List available views/routes
    const showViews = () => {
        addOutput('Available views:', 'info')
        Object.keys(routes).sort().forEach(view => {
            addOutput(`  ${view.padEnd(20)} → ${routes[view]}`, 'normal')
        })
    }

    // Navigate to a view
    const navigateTo = (viewName) => {
        const target = routes[viewName.toLowerCase()]
        if (target) {
            addOutput(`Navigating to ${viewName}...`, 'success')
            router.push(target)
        } else {
            addOutput(`Unknown view: "${viewName}". Type 'views' to see available views.`, 'error')
        }
    }

    // List entities
    const listEntities = async (entity) => {
        const entityLower = entity.toLowerCase()

        try {
            if (entityLower === 'jobs') {
                const result = await fetchJobs()
                if (!result.success) throw new Error(result.error)
                cachedJobs.value = result.jobs || []

                // Store data for structured output
                redirectData = cachedJobs.value
                redirectDataType = 'jobs'

                const recentJobs = cachedJobs.value.slice(0, 10)
                addOutput(`Jobs (${cachedJobs.value.length} total, showing first 10):`, 'info')
                recentJobs.forEach(job => {
                    const status = job.status || 'unknown'
                    const propName = job.properties?.name || job.property_name || 'No property'
                    addOutput([
                        { text: `  #${job.id.slice(0, 8)}...`, link: `/jobs?id=${job.id}`, type: 'link' },
                        { text: ` [${status.toUpperCase().padEnd(12)}] ${propName}` }
                    ])
                })
            } else if (entityLower === 'properties') {
                const result = await listProperties()
                if (!result.success) throw new Error(result.error)
                cachedProperties.value = result.properties || []

                // Store data for structured output
                redirectData = cachedProperties.value
                redirectDataType = 'properties'

                addOutput(`Properties (${cachedProperties.value.length} total):`, 'info')
                cachedProperties.value.slice(0, 15).forEach(prop => {
                    addOutput([
                        { text: '  ' },
                        {
                            text: prop.name || prop.address || 'Unnamed',
                            link: `/properties?id=${prop.id}`,
                            type: 'link'
                        }
                    ])
                })
            } else if (entityLower === 'people' || entityLower === 'staff' || entityLower === 'users') {
                const result = await listPeople()
                if (!result.success) throw new Error(result.error)
                cachedPeople.value = result.people || []

                // Store data for structured output
                redirectData = cachedPeople.value
                redirectDataType = 'people'

                addOutput(`People (${cachedPeople.value.length} total):`, 'info')
                cachedPeople.value.slice(0, 15).forEach(person => {
                    const name = [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Unnamed'
                    addOutput(`  ${name.padEnd(25)} ${person.email || ''}`, 'normal')
                })
            } else if (entityLower === 'opps' || entityLower === 'opportunities' || entityLower === 'service-opportunities') {
                const result = await fetchOpportunities()
                if (!result.success) throw new Error(result.error)
                cachedOpportunities.value = result.opportunities || []

                // Store data for structured output
                redirectData = cachedOpportunities.value
                redirectDataType = 'opps'

                addOutput(`Service Opportunities (${cachedOpportunities.value.length} total, showing first 10):`, 'info')
                cachedOpportunities.value.slice(0, 10).forEach(opp => {
                    const propName = opp.property_name || 'Unknown'
                    const template = opp.service_template_name || opp.title || 'No template'
                    addOutput([
                        { text: '  ' },
                        { text: opp.workflow_status?.padEnd(10) || '?'.padEnd(10) },
                        {
                            text: `${propName} - ${template}`,
                            link: `/service-opportunities?id=${opp.id}`,
                            type: 'link'
                        }
                    ])
                })
            } else {
                addOutput(`Unknown entity: "${entity}". Try: jobs, properties, people, opps`, 'error')
            }
        } catch (err) {
            addOutput(`Error fetching ${entity}: ${err.message}`, 'error')
        }
    }

    // Count entities
    const countEntities = async (entity) => {
        const entityLower = entity.toLowerCase()

        try {
            if (entityLower === 'jobs') {
                const result = await fetchJobs()
                if (!result.success) throw new Error(result.error)
                cachedJobs.value = result.jobs || []
                addOutput(`Jobs: ${cachedJobs.value.length}`, 'info')
            } else if (entityLower === 'properties') {
                const result = await listProperties()
                if (!result.success) throw new Error(result.error)
                cachedProperties.value = result.properties || []
                addOutput(`Properties: ${cachedProperties.value.length}`, 'info')
            } else if (entityLower === 'people' || entityLower === 'staff') {
                const result = await listPeople()
                if (!result.success) throw new Error(result.error)
                cachedPeople.value = result.people || []
                addOutput(`People: ${cachedPeople.value.length}`, 'info')
            } else if (entityLower === 'opps' || entityLower === 'opportunities') {
                const result = await fetchOpportunities()
                if (!result.success) throw new Error(result.error)
                cachedOpportunities.value = result.opportunities || []
                addOutput(`Service Opportunities: ${cachedOpportunities.value.length}`, 'info')
            } else if (entityLower === 'all') {
                const [jobsRes, propsRes, peopleRes, oppsRes] = await Promise.all([
                    fetchJobs(),
                    listProperties(),
                    listPeople(),
                    fetchOpportunities()
                ])
                cachedJobs.value = jobsRes.jobs || []
                cachedProperties.value = propsRes.properties || []
                cachedPeople.value = peopleRes.people || []
                cachedOpportunities.value = oppsRes.opportunities || []

                addOutput('Entity counts:', 'info')
                addOutput(`  Jobs: ${cachedJobs.value.length}`, 'normal')
                addOutput(`  Properties: ${cachedProperties.value.length}`, 'normal')
                addOutput(`  People: ${cachedPeople.value.length}`, 'normal')
                addOutput(`  Service Opportunities: ${cachedOpportunities.value.length}`, 'normal')
            } else {
                addOutput(`Unknown entity: "${entity}". Try: jobs, properties, people, opps, all`, 'error')
            }
        } catch (err) {
            addOutput(`Error counting ${entity}: ${err.message}`, 'error')
        }
    }

    // Search entities
    const searchEntities = async (type, query) => {
        const typeLower = type.toLowerCase()
        const queryLower = query.toLowerCase()

        try {
            if (typeLower === 'job' || typeLower === 'jobs') {
                if (cachedJobs.value.length === 0) {
                    const result = await fetchJobs()
                    if (result.success) cachedJobs.value = result.jobs || []
                }
                const matches = cachedJobs.value.filter(j =>
                    (j.properties?.name || '').toLowerCase().includes(queryLower) ||
                    (j.status || '').toLowerCase().includes(queryLower) ||
                    String(j.id).includes(query)
                )
                addOutput(`Found ${matches.length} job(s) matching "${query}":`, 'info')
                matches.slice(0, 10).forEach(job => {
                    const propName = job.properties?.name || 'No property'
                    addOutput(`  #${job.id.slice(0, 8)}... [${job.status || '?'}] ${propName}`, 'normal')
                })
            } else if (typeLower === 'property' || typeLower === 'properties') {
                if (cachedProperties.value.length === 0) {
                    const result = await listProperties()
                    if (result.success) cachedProperties.value = result.properties || []
                }
                const matches = cachedProperties.value.filter(p =>
                    (p.name || '').toLowerCase().includes(queryLower) ||
                    (p.address || '').toLowerCase().includes(queryLower)
                )
                addOutput(`Found ${matches.length} property/properties matching "${query}":`, 'info')
                matches.slice(0, 10).forEach(prop => {
                    addOutput(`  ${prop.name || prop.address || 'Unnamed'}`, 'normal')
                })
            } else if (typeLower === 'person' || typeLower === 'people') {
                if (cachedPeople.value.length === 0) {
                    const result = await listPeople()
                    if (result.success) cachedPeople.value = result.people || []
                }
                const matches = cachedPeople.value.filter(p =>
                    (p.first_name || '').toLowerCase().includes(queryLower) ||
                    (p.last_name || '').toLowerCase().includes(queryLower) ||
                    (p.email || '').toLowerCase().includes(queryLower)
                )
                addOutput(`Found ${matches.length} person(s) matching "${query}":`, 'info')
                matches.slice(0, 10).forEach(person => {
                    const name = [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Unnamed'
                    addOutput(`  ${name} - ${person.email || 'No email'}`, 'normal')
                })
            } else {
                addOutput(`Unknown search type: "${type}". Try: job, property, person`, 'error')
            }
        } catch (err) {
            addOutput(`Error searching: ${err.message}`, 'error')
        }
    }

    // Refresh all data
    const refreshAll = async () => {
        addOutput('Refreshing all data...', 'info')
        console.log('[CLI DEBUG] refreshAll started, tenantId:', effectiveTenantId.value)
        try {
            console.log('[CLI DEBUG] Calling fetchJobs...')
            const jobsRes = await fetchJobs()
            console.log('[CLI DEBUG] fetchJobs completed')

            console.log('[CLI DEBUG] Calling listProperties...')
            const propsRes = await listProperties()
            console.log('[CLI DEBUG] listProperties completed')

            console.log('[CLI DEBUG] Calling listPeople...')
            const peopleRes = await listPeople()
            console.log('[CLI DEBUG] listPeople completed')

            console.log('[CLI DEBUG] Calling fetchOpportunities...')
            const oppsRes = await fetchOpportunities()
            console.log('[CLI DEBUG] fetchOpportunities completed')

            cachedJobs.value = jobsRes.jobs || []
            cachedProperties.value = propsRes.properties || []
            cachedPeople.value = peopleRes.people || []
            cachedOpportunities.value = oppsRes.opportunities || []
            addOutput('All data refreshed successfully.', 'success')
        } catch (err) {
            console.error('[CLI DEBUG] refreshAll error:', err)
            addOutput(`Error refreshing: ${err.message}`, 'error')
        }
    }

    // Show command history
    const showHistory = () => {
        if (commandHistory.value.length === 0) {
            addOutput('No command history.', 'info')
            return
        }
        addOutput('Command history:', 'info')
        commandHistory.value.slice(-20).forEach((cmd, idx) => {
            addOutput(`  ${idx + 1}. ${cmd}`, 'normal')
        })
    }

    // Parse and execute a command
    const executeCommand = async (input) => {
        const trimmed = input.trim()
        if (!trimmed) return

        // Defensive reset: ensure previous pipe state doesn't affect new commands
        redirectBuffer = null
        redirectData = null
        redirectDataType = null
        redirectFilename = null

        // Check for file redirect syntax: command > filename.txt
        const redirectMatch = trimmed.match(/^(.+?)\s*>\s*([\w.-]+)$/)
        // Check for clipboard pipe syntax: command | clipboard
        const clipboardMatch = trimmed.match(/^(.+?)\s*\|\s*clipboard$/i)
        // Check for JSON pipe syntax: command | json
        const jsonMatch = trimmed.match(/^(.+?)\s*\|\s*json$/i)
        // Check for CSV pipe syntax: command | csv
        const csvMatch = trimmed.match(/^(.+?)\s*\|\s*csv$/i)

        let actualCommand = trimmed
        let isRedirect = false
        let isClipboard = false
        let isJson = false
        let isCsv = false

        if (redirectMatch) {
            actualCommand = redirectMatch[1].trim()
            redirectFilename = redirectMatch[2]
            redirectBuffer = []
            isRedirect = true
        } else if (clipboardMatch) {
            actualCommand = clipboardMatch[1].trim()
            redirectBuffer = []
            isClipboard = true
        } else if (jsonMatch) {
            actualCommand = jsonMatch[1].trim()
            redirectBuffer = []
            redirectData = null
            isJson = true
        } else if (csvMatch) {
            actualCommand = csvMatch[1].trim()
            redirectBuffer = []
            redirectData = null
            isCsv = true
        }

        commandHistory.value.push(trimmed)
        saveToLocalStorage() // Persist command history

        // Show command in terminal (not redirected)
        outputLines.value.push({
            content: [{ text: `$ ${trimmed}`, type: 'command' }],
            timestamp: new Date()
        })

        isProcessing.value = true

        try {
            const parts = actualCommand.split(/\s+/)
            const cmd = parts[0].toLowerCase()
            const args = parts.slice(1)

            switch (cmd) {
                case 'j':
                case 'p':
                case 'so':
                case 's':
                case 'ls':
                    // Alias handling
                    if (cmd === 'j') await listEntities('jobs')
                    else if (cmd === 'p') await listEntities('properties')
                    else if (cmd === 'so') await listEntities('opps')
                    else if ((cmd === 's' || cmd === 'find') && args.length >= 2) await searchEntities(args[0], args.slice(1).join(' '))
                    else if (cmd === 'ls') {
                        if (args[0]) await listEntities(args[0])
                        else addOutput('Usage: ls <jobs|properties|people|opps>', 'error')
                    }
                    break

                case 'help':
                case '?':
                    showHelp()
                    break

                case 'clear':
                case 'cls':
                    clearOutput()
                    break

                case 'views':
                case 'routes':
                    showViews()
                    break

                case 'go':
                case 'g':
                case 'nav':
                case 'cd':
                    if (args[0]) {
                        navigateTo(args[0])
                    } else {
                        addOutput('Usage: go <view>', 'error')
                    }
                    break

                case 'list':
                case 'ls':
                case 'show':
                    if (args[0]) {
                        await listEntities(args[0])
                    } else {
                        addOutput('Usage: list <jobs|properties|people|opps>', 'error')
                    }
                    break

                case 'count':
                    if (args[0]) {
                        await countEntities(args[0])
                    } else {
                        addOutput('Usage: count <jobs|properties|people|opps|all>', 'error')
                    }
                    break

                case 'find':
                case 'search':
                    if (args.length >= 2) {
                        await searchEntities(args[0], args.slice(1).join(' '))
                    } else {
                        addOutput('Usage: find <job|property|person> <query>', 'error')
                    }
                    break

                case 'refresh':
                case 'reload':
                    await refreshAll()
                    break

                case 'history':
                    showHistory()
                    break

                case 'time':
                case 'date':
                    addOutput(new Date().toLocaleString(), 'info')
                    break

                case 'whoami':
                    addOutput('Power User CLI v1.0', 'info')
                    addOutput('ServativPro Command Interface', 'normal')
                    break

                case 'echo':
                    addOutput(args.join(' '), 'normal')
                    break

                case 'debug':
                    addOutput('=== Debug Info ===', 'info')
                    addOutput(`User ID: ${user.value?.id || 'null'}`, 'normal')
                    addOutput(`User Email: ${user.value?.email || 'null'}`, 'normal')
                    addOutput(`Tenant ID: ${effectiveTenantId.value || 'null'}`, 'normal')
                    addOutput(`Profile loaded: ${userProfile.value ? 'yes' : 'no'}`, 'normal')
                    if (userProfile.value) {
                        addOutput(`Profile tenant_id: ${userProfile.value.tenant_id || 'null'}`, 'normal')
                    }
                    break

                default:
                    // Check if it's a direct view name (shortcut)
                    if (routes[cmd]) {
                        navigateTo(cmd)
                    } else {
                        addOutput(`Unknown command: "${cmd}". Type 'help' for available commands.`, 'error')
                    }
            }
        } catch (err) {
            addOutput(`Error: ${err.message}`, 'error')
        } finally {
            // Handle file redirect/download
            if (isRedirect && redirectBuffer !== null) {
                const content = redirectBuffer.join('\n')
                downloadFile(redirectFilename, content)

                // Show confirmation in terminal
                outputLines.value.push({
                    content: [{ text: `Downloaded: ${redirectFilename} (${content.length} bytes)`, type: 'success' }],
                    timestamp: new Date()
                })

                // Reset redirect state
                redirectBuffer = null
                redirectFilename = null
            }

            // Handle clipboard pipe
            if (isClipboard && redirectBuffer !== null) {
                const content = redirectBuffer.join('\n')

                try {
                    await navigator.clipboard.writeText(content)

                    // Show confirmation in terminal
                    outputLines.value.push({
                        content: [{ text: `Copied to clipboard (${content.length} bytes)`, type: 'success' }],
                        timestamp: new Date()
                    })
                } catch (clipErr) {
                    outputLines.value.push({
                        content: [{ text: `Clipboard error: ${clipErr.message}`, type: 'error' }],
                        timestamp: new Date()
                    })
                }

                // Reset redirect state
                redirectBuffer = null
            }

            // Handle JSON pipe
            if (isJson && redirectData !== null) {
                const content = JSON.stringify(redirectData, null, 2)

                try {
                    await navigator.clipboard.writeText(content)

                    outputLines.value.push({
                        content: [{ text: `JSON copied to clipboard (${redirectData.length} records, ${content.length} bytes)`, type: 'success' }],
                        timestamp: new Date()
                    })
                } catch (clipErr) {
                    outputLines.value.push({
                        content: [{ text: `Clipboard error: ${clipErr.message}`, type: 'error' }],
                        timestamp: new Date()
                    })
                }

                // Reset
                redirectBuffer = null
                redirectData = null
                redirectDataType = null
            }

            // Handle CSV pipe
            if (isCsv && redirectData !== null) {
                const content = toCSV(redirectData, redirectDataType)

                try {
                    await navigator.clipboard.writeText(content)

                    outputLines.value.push({
                        content: [{ text: `CSV copied to clipboard (${redirectData.length} records)`, type: 'success' }],
                        timestamp: new Date()
                    })
                } catch (clipErr) {
                    outputLines.value.push({
                        content: [{ text: `Clipboard error: ${clipErr.message}`, type: 'error' }],
                        timestamp: new Date()
                    })
                }

                // Reset
                redirectBuffer = null
                redirectData = null
                redirectDataType = null
            }

            isProcessing.value = false
        }
    }

    // Get command from history
    const getHistoryCommand = (offset) => {
        const idx = commandHistory.value.length - offset
        if (idx >= 0 && idx < commandHistory.value.length) {
            return commandHistory.value[idx]
        }
        return null
    }

    return {
        commandHistory,
        outputLines,
        isProcessing,
        executeCommand,
        addOutput,
        clearOutput,
        getHistoryCommand,
        getCompletions
    }
}
