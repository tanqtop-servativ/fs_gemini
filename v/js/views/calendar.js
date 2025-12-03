import { supabase } from '../supabase.js';

export function renderCalendar(container) {
    // 1. Render Skeleton IMMEDIATELY
    container.innerHTML = `
      <div class="flex flex-col h-full">
        <div class="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
          <div><h1 class="text-2xl font-bold text-slate-900">Master Calendar</h1></div>
          <div class="flex gap-2">
            <select id="propertySelector" class="border border-gray-300 rounded-lg p-2 text-sm bg-white min-w-[200px]"></select>
            <select id="viewSelector" class="border border-gray-300 rounded-lg p-2 text-sm bg-white font-medium">
              <option value="dayGridMonth" selected>Month</option>
              <option value="timeGridWeek">Week</option>
            </select>
          </div>
        </div>
        <div id="calendarEl" class="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex-1 min-h-[600px]"></div>
      </div>`;
    
    // 2. Wait for DOM, then Init Logic
    setTimeout(() => initCalendarLogic(), 50);
}

async function initCalendarLogic() {
    const calendarEl = document.getElementById('calendarEl');
    const propSelector = document.getElementById('propertySelector');
    
    if (!calendarEl || !propSelector) return; // View switched

    // 1. Load Properties
    const { data: properties } = await supabase.from('properties').select('id, name').eq('status', 'active');
    if (!properties || properties.length === 0) {
        calendarEl.innerHTML = '<div class="text-gray-400 p-10 text-center">No properties available.</div>';
        return;
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
        return;
    }

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
        height: '100%',
        allDaySlot: true,
        events: [], 
        eventDidMount: function(info) {
            const props = info.event.extendedProps;
            if(tippy) {
                tippy(info.el, { 
                    content: `<div style="text-align:left;">
                        <strong style="font-size:1.1em;">${info.event.title}</strong><br>
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
        const { data: events, error } = await supabase.from('master_calendar').select('*').eq('property_id', propId);
        if (error) { console.error(error); return; }

        const fcEvents = events.map(evt => ({
            id: evt.id,
            title: evt.title,
            start: evt.start_date,
            end: evt.end_date,
            color: evt.color,
            classNames: [evt.class_name],
            allDay: evt.all_day,
            extendedProps: { description: evt.description, code: evt.code }
        }));

        calendar.removeAllEvents();
        calendar.addEventSource(fcEvents);
    };

    // Bind
    propSelector.addEventListener('change', (e) => loadCalData(e.target.value));
    document.getElementById('viewSelector').addEventListener('change', (e) => calendar.changeView(e.target.value));
    
    // Initial Load
    loadCalData(properties[0].id);
}
