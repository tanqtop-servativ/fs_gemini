import { supabase } from '../supabase.js';

export function renderCalendar(container) {
    // 1. Render Skeleton IMMEDIATELY
    container.innerHTML = `
      <div class="flex flex-col h-full">
        <div class="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
          <div><h1 class="text-2xl font-bold text-slate-900">Master Calendar</h1></div>
          <div class="flex gap-2">
            <select id="propertySelector" class="border border-gray-300 rounded-lg p-2 text-sm bg-white min-w-[200px]">
                <option value="all">All Properties</option>
            </select>
            <select id="viewSelector" class="border border-gray-300 rounded-lg p-2 text-sm bg-white font-medium">
              <option value="dayGridMonth">Month</option>
              <option value="timeGridWeek">Week</option>
              <option value="timeGridDay" selected>Day (Timeline)</option>
              <option value="listWeek">List</option>
            </select>
          </div>
        </div>
        <div id="calendarEl" class="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex-1 min-h-[600px]"></div>
      </div>`;

    // 2. Wait for DOM, then Init Logic
    // We wrap this in a Promise to return the cleanup function
    return new Promise((resolve) => {
        setTimeout(async () => {
            const cleanup = await initCalendarLogic();
            resolve(cleanup);
        }, 50);
    });
}

async function initCalendarLogic() {
    const calendarEl = document.getElementById('calendarEl');
    const propSelector = document.getElementById('propertySelector');

    if (!calendarEl || !propSelector) return null; // View switched

    // 1. Load Properties
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

    // 2. Init FullCalendar
    if (typeof FullCalendar === 'undefined') {
        calendarEl.innerHTML = '<div class="text-red-500">Error: FullCalendar not loaded.</div>';
        return null;
    }

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridDay', // Default to Day view as requested
        headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
        height: '100%',
        allDaySlot: true,
        slotMinTime: '06:00:00',
        slotMaxTime: '22:00:00',
        events: [],
        eventContent: function (arg) {
            // Custom render to match screenshot
            const props = arg.event.extendedProps;
            const timeText = arg.timeText;

            // If it's a small slot, show minimal info
            return {
                html: `
                <div class="p-1 overflow-hidden h-full flex flex-col justify-center leading-tight">
                    <div class="font-bold text-xs truncate">${arg.event.title}</div>
                    ${props.property_name ? `<div class="text-[10px] truncate opacity-90">${props.property_name}</div>` : ''}
                    ${props.property_address ? `<div class="text-[9px] truncate opacity-75">${props.property_address}</div>` : ''}
                </div>`
            };
        },
        eventDidMount: function (info) {
            const props = info.event.extendedProps;
            if (tippy) {
                tippy(info.el, {
                    content: `<div style="text-align:left;">
                        <strong style="font-size:1.1em;">${info.event.title}</strong><br>
                        <span style="color:#666; font-size:0.9em;">${props.property_name || ''}</span><br>
                        <span style="color:#888; font-size:0.8em;">${props.property_address || ''}</span><br>
                        <span style="color:#666; font-size:0.9em;">${props.code || ''}</span>
                    </div>`,
                    allowHTML: true, theme: 'light-border'
                });
            }
        }
    });
    calendar.render();

    // 3. Fetch Data Function
    const loadCalData = async (propId) => {
        let query = supabase.from('master_calendar').select('*');

        if (propId !== 'all') {
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
                code: evt.code,
                property_name: evt.property_name,
                property_address: evt.property_address
            }
        }));

        calendar.removeAllEvents();
        calendar.addEventSource(fcEvents);
    };

    // Bind
    const onPropChange = (e) => loadCalData(e.target.value);
    const onViewChange = (e) => calendar.changeView(e.target.value);

    propSelector.addEventListener('change', onPropChange);
    document.getElementById('viewSelector').addEventListener('change', onViewChange);

    // Initial Load
    loadCalData(properties[0].id);

    // RETURN CLEANUP FUNCTION
    return () => {
        console.log("Destroying Calendar...");
        calendar.destroy();
        // Listeners on elements are removed when elements are removed from DOM, 
        // but explicit removal is safer if we kept references.
        // propSelector.removeEventListener('change', onPropChange); // Element is gone anyway
    };
}
