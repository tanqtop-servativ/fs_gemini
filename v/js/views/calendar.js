
import { supabase } from '../supabase.js';
import { openEditOppModal } from './service_opportunities.js';

export function renderCalendar(container) {
    // 1. Render Skeleton IMMEDIATELY
    container.innerHTML = `
      <div class="flex flex-col h-full relative">
        <div class="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
          <div><h1 class="text-2xl font-bold text-slate-900">Master Calendar</h1></div>
          <div class="flex gap-2 items-center">
            <select id="propertySelector" class="border border-gray-300 rounded-lg p-2 text-sm bg-white min-w-[200px]">
                <option value="all">All Properties</option>
            </select>
            <div class="border-l border-gray-300 h-6 mx-2"></div>
            <select id="viewSelector" class="border border-gray-300 rounded-lg p-2 text-sm bg-white font-medium">
              <option value="multiMonthYear">Month View</option>
              <option value="timeGridWeek">Week</option>
              <option value="timeGridDay">Day (Timeline)</option>
              <option value="listWeek">List</option>
            </select>
             <select id="monthSelector" class="border border-gray-300 rounded-lg p-2 text-sm bg-white font-medium" title="Number of months to show">
              <option value="1" selected>1 Month</option>
              <option value="2">2 Months</option>
              <option value="3">3 Months</option>
              <option value="4">4 Months</option>
              <option value="5">5 Months</option>
              <option value="6">6 Months</option>
            </select>
          </div>
        </div>
        <div id="calendarEl" class="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex-1 min-h-[600px]"></div>
      </div>`;

    // 2. Wait for DOM, then Init Logic
    return new Promise((resolve) => {
        setTimeout(async () => {
            const cleanup = await initCalendarLogic('calendarEl', 'propertySelector', 'viewSelector', 'monthSelector');
            resolve(cleanup);
        }, 50);
    });
}

export function renderEmbeddedCalendar(container, propertyId) {
    const uniqueSuffix = Math.random().toString(36).substring(7);
    const viewSelId = `embViewSelector-${uniqueSuffix}`;
    const monthSelId = `embMonthSelector-${uniqueSuffix}`;
    const calElId = `embCalendarEl-${uniqueSuffix}`;

    // Simplified skeleton for modal
    container.innerHTML = `
      <div class="flex flex-col h-full relative">
        <div class="flex justify-end mb-2 gap-2">
            <select id="${viewSelId}" class="border border-gray-300 rounded-lg p-1 text-xs bg-white font-medium">
              <option value="multiMonthYear" selected>Month</option>
              <option value="timeGridWeek">Week</option>
              <option value="timeGridDay">Day</option>
              <option value="listWeek">List</option>
            </select>
            <select id="${monthSelId}" class="border border-gray-300 rounded-lg p-1 text-xs bg-white font-medium" title="Number of months to show">
              <option value="1" selected>1 Month</option>
              <option value="2">2 Months</option>
              <option value="3">3 Months</option>
              <option value="4">4 Months</option>
              <option value="5">5 Months</option>
              <option value="6">6 Months</option>
            </select>
        </div>
        <div id="${calElId}" class="bg-white rounded-lg border border-gray-200 flex-1 min-h-[500px]"></div>
      </div>`;

    return new Promise((resolve) => {
        setTimeout(async () => {
            // Init with UNIQUE IDs
            const cleanup = await initCalendarLogic(calElId, null, viewSelId, monthSelId, propertyId);
            resolve(cleanup);
        }, 50);
    });
}

async function initCalendarLogic(calendarElId, propSelectorId, viewSelectorId, monthSelectorId, fixedPropertyId = null) {
    const calendarEl = document.getElementById(calendarElId);
    if (!calendarEl) return null;

    // --- CONTEXT MENU SETUP ---
    const ctxMenuId = `ctx-menu-${calendarElId}`;
    let ctxMenu = document.getElementById(ctxMenuId);
    if (ctxMenu) ctxMenu.remove(); // Cleanup old if exists

    ctxMenu = document.createElement('div');
    ctxMenu.id = ctxMenuId;
    ctxMenu.className = 'absolute bg-white border border-gray-200 shadow-lg rounded-lg py-1 z-[9999] hidden min-w-[160px] text-sm';
    ctxMenu.innerHTML = `
        <div id="${ctxMenuId}-new-opp" class="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2 text-slate-700">
            <i data-lucide="briefcase" class="w-4 h-4 text-gray-400"></i> New Service Opp
        </div>
        <div id="${ctxMenuId}-new-booking" class="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2 text-slate-700">
            <i data-lucide="plus-circle" class="w-4 h-4 text-gray-400"></i> New Booking
        </div>
    `;
    document.body.appendChild(ctxMenu); // Append to body for positioning
    lucide.createIcons();

    // Context State
    let clickedDate = null;
    let clickedPropId = fixedPropertyId;

    // --- EVENT LISTENERS ---

    // 1. Context Menu Trigger
    calendarEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();

        const dayEl = e.target.closest('[data-date]');
        if (!dayEl) return;

        clickedDate = dayEl.getAttribute('data-date');

        // Determine Property ID
        if (fixedPropertyId) {
            clickedPropId = fixedPropertyId;
        } else if (propSelectorId) {
            const val = document.getElementById(propSelectorId).value;
            clickedPropId = (val && val !== 'all') ? val : null; // If 'all', we pass null to let modal handle it
        }

        // Position
        ctxMenu.style.left = `${e.pageX}px`;
        ctxMenu.style.top = `${e.pageY}px`;
        ctxMenu.style.display = 'block';
    });

    // 2. Hide Menu on Click Outside
    const hideMenu = () => { ctxMenu.style.display = 'none'; };
    document.addEventListener('click', hideMenu);

    // 3. Menu Item Actions
    document.getElementById(`${ctxMenuId}-new-opp`).onclick = () => {
        openEditOppModal(null, {
            property_id: clickedPropId,
            due_date: clickedDate,
            lock_property: !!clickedPropId // Lock if we have a property context
        });
    };

    // Placeholder for new booking if needed
    document.getElementById(`${ctxMenuId}-new-booking`).onclick = () => {
        alert("Create Booking feature coming soon!");
    };


    let propSelector = null;
    if (propSelectorId) {
        propSelector = document.getElementById(propSelectorId);

        // Load Properties for selector
        const { data: properties } = await supabase.from('properties').select('id, name').eq('status', 'active');
        if (!properties || properties.length === 0) {
            calendarEl.innerHTML = '<div class="text-gray-400 p-10 text-center">No properties available.</div>';
            return null;
        }

        properties.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            propSelector.appendChild(opt);
        });
    }

    // 2. Init FullCalendar
    if (typeof FullCalendar === 'undefined') {
        calendarEl.innerHTML = '<div class="text-red-500">Error: FullCalendar not loaded.</div>';
        return null;
    }

    const initialMonths = 1;

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'multiMonth1',
        views: {
            multiMonth1: { type: 'multiMonthYear', duration: { months: 1 }, multiMonthMaxColumns: 1 },
            multiMonth2: { type: 'multiMonthYear', duration: { months: 2 }, multiMonthMaxColumns: 1 },
            multiMonth3: { type: 'multiMonthYear', duration: { months: 3 }, multiMonthMaxColumns: 1 },
            multiMonth4: { type: 'multiMonthYear', duration: { months: 4 }, multiMonthMaxColumns: 1 },
            multiMonth5: { type: 'multiMonthYear', duration: { months: 5 }, multiMonthMaxColumns: 1 },
            multiMonth6: { type: 'multiMonthYear', duration: { months: 6 }, multiMonthMaxColumns: 1 },
        },
        headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
        height: '100%',
        allDaySlot: true,
        slotMinTime: '06:00:00',
        slotMaxTime: '22:00:00',
        events: [],
        eventContent: function (arg) {
            const props = arg.event.extendedProps;
            // Simplified content for MultiMonth view to avoid overflow
            if (arg.view.type.startsWith('multiMonth')) {
                return {
                    html: `<div class="text-[10px] truncate px-1 rounded-sm leading-tight" style="color:${arg.event.textColor || '#fff'}">${arg.event.title}</div>`
                };
            }

            return {
                html: `
                <div class="p-1 overflow-hidden h-full flex flex-col justify-center leading-tight">
                    <div class="font-bold text-xs truncate">${arg.event.title}</div>
                    ${props.property_name ? `<div class="text-[10px] truncate opacity-90">${props.property_name}</div>` : ''}
                </div>`
            };
        },
        eventDidMount: function (info) {
            const props = info.event.extendedProps;
            // Add context listener to events too (stop prop to let cell catch it? or handle here?)
            // FullCalendar bubbling works well commonly, let's rely on container listener.

            if (tippy) {
                const fmt = (d) => d ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
                const timeStr = `${fmt(info.event.start)} - ${fmt(info.event.end)}`;

                tippy(info.el, {
                    content: `
                        <div class="font-bold">${info.event.title}</div>
                        <div class="text-xs text-blue-200 border-b border-white/20 pb-1 mb-1">${timeStr}</div>
                        <div class="text-xs">${props.property_name || ''}</div>
                        <div class="text-[10px] opacity-75">${props.property_address || ''}</div>
                    `,
                    allowHTML: true,
                    theme: 'light-border' // Optional, if configured, but default is usually fine
                });
            }
        }
    });
    calendar.render();

    // 3. Fetch Data Function
    const loadCalData = async (propId) => {
        let query = supabase.from('master_calendar').select('*');

        if (propId && propId !== 'all') {
            query = query.eq('property_id', propId);
        }

        const { data: events, error } = await query;
        if (error) { console.error(error); return; }

        const fcEvents = events.map(evt => ({
            id: evt.id,
            title: evt.title,
            start: evt.start_date,
            end: evt.end_date,
            color: evt.color,
            classNames: [evt.class_name],
            allDay: evt.all_day,
            extendedProps: {
                description: evt.description,
                property_name: evt.property_name,
                property_address: evt.property_address
            }
        }));

        calendar.removeAllEvents();
        calendar.addEventSource(fcEvents);
    };

    // Bind
    const onPropChange = (e) => loadCalData(e.target.value);

    const onViewChange = (e) => {
        const viewName = e.target.value;
        // If user selects "multiMonthYear" from dropdown, default to 1 month (or current selection? logic needed)
        // Actually, the main view selector should probably map "multiMonthYear" to "multiMonth1" initially
        // OR we check if viewName STARTS with multiMonth

        let targetView = viewName;
        if (viewName === 'multiMonthYear') {
            const currentMonthVal = document.getElementById(monthSelectorId)?.value || '1';
            targetView = 'multiMonth' + currentMonthVal;
        }

        calendar.changeView(targetView);

        // Show/Hide Month Selector based on view type
        const monthSel = document.getElementById(monthSelectorId);
        if (monthSel) {
            monthSel.style.display = (targetView.startsWith('multiMonth')) ? 'inline-block' : 'none';
        }
    };

    const onMonthChange = (e) => {
        const months = e.target.value;
        calendar.changeView('multiMonth' + months);

        // Ensure View Selector matches "Month View" concept
        const viewSel = document.getElementById(viewSelectorId);
        if (viewSel && viewSel.value !== 'multiMonthYear') viewSel.value = 'multiMonthYear';
    };

    if (propSelector) {
        propSelector.addEventListener('change', onPropChange);
    }

    const viewSel = document.getElementById(viewSelectorId);
    if (viewSel) viewSel.addEventListener('change', onViewChange);

    const monthSel = document.getElementById(monthSelectorId);
    if (monthSel) {
        monthSel.addEventListener('change', onMonthChange);
        // Initial state: hide if not multiMonthYear
        if (viewSel && viewSel.value !== 'multiMonthYear') {
            monthSel.style.display = 'none';
        }
    }

    // Initial Load
    loadCalData(fixedPropertyId || (propSelector ? propSelector.value : 'all'));

    // RETURN CLEANUP FUNCTION
    return () => {
        console.log("Destroying Calendar & Menu...");
        calendar.destroy();
        document.removeEventListener('click', hideMenu);
        ctxMenu.remove();
    };
}

