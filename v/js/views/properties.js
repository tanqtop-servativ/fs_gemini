import { supabase } from '../supabase.js';
import { renderAuditHistory } from './audit.js';
import { setupModalGuard } from '../modal_utils.js';
import { getTenantId, renderAddressWithLink } from '../utils.js';
import { uploadFile } from '../storage_utils.js';



export async function renderProperties(container) {
    container.innerHTML = `
      <div class="mb-6 flex justify-between items-center">
        <div><h1 class="text-2xl font-bold text-slate-900">Properties</h1><p class="text-gray-500">Manage units & assignments</p></div>
        <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input type="checkbox" id="chk-show-archived" class="rounded border-gray-300 text-black focus:ring-0">
                Show Archived
            </label>
            <button id="btn-new-prop" class="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-gray-800 transition">
                <i data-lucide="plus" class="w-4 h-4 mr-2"></i> New Property
            </button>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
              <th class="px-6 py-4">Property</th>
              <th class="px-6 py-4">Address</th>
              <th class="px-6 py-4">Assignments</th>
              <th class="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody id="props-body"><tr><td colspan="4" class="px-6 py-8 text-center text-gray-400">Loading...</td></tr></tbody>
        </table>
      </div>`;

    document.getElementById('btn-new-prop').onclick = () => openEditModal(null);
    document.getElementById('chk-show-archived').onchange = (e) => loadTableData(e.target.checked);
    await loadTableData();
}

async function loadTableData(showArchived = false) {
    let query = supabase.from('properties_enriched').select('*');

    if (showArchived) {
        query = query.eq('status', 'archived');
    } else {
        query = query.eq('status', 'active');
    }

    // Filter by tenant_id if available (for impersonation or strict scoping)
    if (window.currentUser && window.currentUser.tenant_id) {
        query = query.eq('tenant_id', window.currentUser.tenant_id);
    }

    const { data: props, error } = await query.order('name');
    const tbody = document.getElementById('props-body');
    if (error) return tbody.innerHTML = `<tr><td colspan="4" class="text-red-500 px-6 py-4">Error: ${error.message}</td></tr>`;
    if (!props || !props.length) return tbody.innerHTML = `<tr><td colspan="4" class="text-center px-6 py-8 text-gray-400">No properties found.</td></tr>`;

    tbody.innerHTML = props.map(p => {
        const isArchived = p.status === 'archived';
        const thumb = p.front_photo_url
            ? `<img src="${p.front_photo_url}" class="w-10 h-10 rounded object-cover border border-gray-200 ${isArchived ? 'grayscale' : ''}">`
            : `<div class="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-slate-400"><i data-lucide="home" class="w-5 h-5"></i></div>`;

        return `<tr class="border-b border-gray-100 ${isArchived ? 'bg-gray-50 opacity-75' : 'hover:bg-gray-50'} group cursor-pointer" onclick="window.viewProp('${p.id}')">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    ${thumb}
                    <span class="font-bold ${isArchived ? 'text-gray-500 line-through' : 'text-slate-900'}">${p.name}</span>
                    ${isArchived ? '<span class="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase no-underline">Archived</span>' : ''}
                </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600 max-w-xs">${renderAddressWithLink(p.display_address)}</td>
            <td class="px-6 py-4 text-xs text-gray-600">
                <div class="flex items-center gap-1"><span class="font-bold text-slate-400 w-12">Own:</span> ${p.owner_names || 'None'}</div>
                <div class="flex items-center gap-1"><span class="font-bold text-slate-400 w-12">Mgr:</span> ${p.manager_names || 'None'}</div>
            </td>
            <td class="px-6 py-4 text-right">
                <button class="text-slate-400 hover:text-blue-600 p-2"><i data-lucide="eye" class="w-4 h-4"></i></button>
            </td>
        </tr>`;
    }).join('');

    window.viewProp = (id) => openDetailModal(id);
    lucide.createIcons();
}

async function openDetailModal(propId) {
    const { data: prop } = await supabase.from('properties_enriched').select('*').eq('id', propId).single();
    if (prop) openReadModal(prop);
}

// --- READ MODAL ---
async function openReadModal(prop) {
    const container = document.getElementById('modal-container');

    // Fetch related data for display
    const { data: codes } = await supabase.from('property_access_codes').select('*').eq('property_id', prop.id);
    const { data: feeds } = await supabase.from('calendar_feeds').select('*').eq('property_id', prop.id);
    const { data: inventory } = await supabase.from('property_inventory').select('*').eq('property_id', prop.id);
    const { data: refPhotos } = await supabase.from('property_reference_photos').select('*').eq('property_id', prop.id).order('sort_order');
    const { data: attachments } = await supabase.from('property_attachments').select('*').eq('property_id', prop.id).order('created_at', { ascending: false });

    const getCode = (t) => { const f = (codes || []).find(c => c.code_type === t); return f ? f.code_value : null; };

    const photoHtml = prop.front_photo_url
        ? `<img src="${prop.front_photo_url}" class="w-full h-64 object-cover rounded-t-xl">`
        : `<div class="w-full h-64 bg-slate-100 flex items-center justify-center text-slate-400"><i data-lucide="image" class="w-12 h-12"></i></div>`;

    const feedList = (feeds && feeds.length)
        ? feeds.map(f => `<div class="text-xs flex justify-between border-b border-gray-50 py-1"><span>${f.name}</span><span class="text-gray-400 truncate w-32">${f.url}</span></div>`).join('')
        : null;

    const invList = (inventory && inventory.length)
        ? inventory.map(i => `<div class="text-xs flex justify-between border-b border-gray-50 py-1"><span>${i.item_name}</span><span class="font-bold">${i.quantity}</span></div>`).join('')
        : null;

    const refPhotoList = (refPhotos && refPhotos.length)
        ? `<div class="grid grid-cols-3 gap-2 mt-2">` + refPhotos.map(p => `
            <a href="${p.public_url}" target="_blank" class="block relative group">
                <img src="${p.public_url}" class="w-full h-20 object-cover rounded border border-gray-200">
                ${p.label ? `<div class="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] p-1 truncate">${p.label}</div>` : ''}
            </a>`).join('') + `</div>`
        : null;

    const attList = (attachments && attachments.length)
        ? attachments.map(a => `
            <div class="flex justify-between items-center border-b border-gray-50 py-1">
                <a href="${a.public_url}" target="_blank" class="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <i data-lucide="file" class="w-3 h-3"></i> ${a.file_name}
                </a>
                <span class="text-[10px] text-gray-400">${new Date(a.created_at).toLocaleDateString()}</span>
            </div>`).join('')
        : null;

    // Helper to render a row only if value exists
    const renderRow = (label, val, isMono = false) => val ? `<div class="flex justify-between"><span class="text-gray-500">${label}</span> <span class="${isMono ? 'font-mono ' : ''}font-bold">${val}</span></div>` : '';

    // Build Sections
    let wifiSection = '';
    if (prop.wifi_network || prop.wifi_password) {
        wifiSection = `
            <div class="bg-indigo-50 p-4 rounded-lg border border-indigo-100 mb-4">
                <h3 class="text-xs font-bold uppercase text-indigo-500 mb-3">Wifi</h3>
                <div class="space-y-2 text-sm">
                    ${renderRow('Network', prop.wifi_network)}
                    ${renderRow('Password', prop.wifi_password, true)}
                </div>
            </div>`;
    }

    let codesHtml = '';
    const cDoor = getCode('Door');
    const cGarage = getCode('Garage');
    const cGate = getCode('Community Gate');
    const cCloset = getCode('Owner Closet');
    const cCasita = getCode('Casita');

    if (cDoor || cGarage || cGate || cCloset || cCasita) {
        codesHtml = `
            <div class="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-4">
                <h3 class="text-xs font-bold uppercase text-slate-500 mb-3">Access Codes</h3>
                <div class="space-y-2 text-sm">
                    ${renderRow('Door', cDoor, true)}
                    ${renderRow('Garage', cGarage, true)}
                    ${renderRow('Gate', cGate, true)}
                    ${renderRow('Closet', cCloset, true)}
                    ${cCasita ? `<div class="flex justify-between text-purple-600"><span class="font-bold">Casita</span> <span class="font-mono font-bold">${cCasita}</span></div>` : ''}
                </div>
            </div>`;
    }

    let specsHtml = '';
    if (prop.bedrooms || prop.bathrooms || prop.max_guests || prop.square_footage) {
        specsHtml = `
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                <h3 class="text-xs font-bold uppercase text-blue-500 mb-3">Details</h3>
                <div class="space-y-2 text-sm">
                    ${renderRow('Bedrooms', prop.bedrooms)}
                    ${renderRow('Bathrooms', prop.bathrooms)}
                    ${renderRow('Max Guests', prop.max_guests)}
                    ${renderRow('Sq Ft', prop.square_footage)}
                    ${renderRow('Sinks', prop.bathroom_sinks)}
                    ${renderRow('Bath Mats', prop.bath_mats)}
                </div>
            </div>`;
    }

    let amenitiesHtml = '';
    if (prop.has_pool || prop.has_bbq || prop.allows_pets || prop.has_casita) {
        amenitiesHtml = `
            <div class="bg-pink-50 p-4 rounded-lg border border-pink-100 mb-4">
                <h3 class="text-xs font-bold uppercase text-pink-500 mb-3">Amenities</h3>
                <div class="space-y-2 text-sm">
                    ${prop.has_pool ? renderRow('Pool', '✅') : ''}
                    ${prop.has_bbq ? renderRow('BBQ', '✅') : ''}
                    ${prop.allows_pets ? renderRow('Pets Allowed', '✅') : ''}
                    ${prop.has_casita ? renderRow('Casita', '✅') : ''}
                </div>
            </div>`;
    }

    let parkingHtml = '';
    if (prop.parking_instructions) {
        parkingHtml = `
            <div class="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
                <h3 class="text-xs font-bold uppercase text-gray-500 mb-2">Parking Instructions</h3>
                <p class="text-sm text-gray-700 whitespace-pre-wrap">${prop.parking_instructions}</p>
            </div>`;
    }

    container.innerHTML = `
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            ${photoHtml}
            <div class="p-6">
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-900">${prop.name}</h2>
                        <div class="text-gray-500 text-sm">${renderAddressWithLink(prop.display_address, "w-4 h-4")}</div>
                    </div>
                    <div class="text-right flex flex-col items-end gap-2">
                        <button id="btn-edit-prop" class="text-gray-400 hover:text-black transition-colors" title="Edit Property">
                            <i data-lucide="pencil" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <!-- Column 1: Codes & Wifi -->
                    <div>
                        ${codesHtml}
                        ${wifiSection}
                    </div>

                    <!-- Column 2: Specs & Amenities -->
                    <div>
                        ${specsHtml}
                        ${amenitiesHtml}
                        <div class="bg-orange-50 p-4 rounded-lg border border-orange-100 mb-4">
                            <h3 class="text-xs font-bold uppercase text-orange-500 mb-3">Timings</h3>
                            <div class="space-y-2 text-sm">
                                ${renderRow('Check-in', prop.check_in_time)}
                                ${renderRow('Check-out', prop.check_out_time)}
                                ${renderRow('Time Zone', prop.time_zone)}
                                ${prop.is_dst ? '<div class="flex justify-between border-b border-orange-200/50 pb-1 last:border-0"><span class="text-gray-500">DST Observed</span><span class="font-medium text-slate-800">Yes</span></div>' : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Column 3: Lists -->
                    <div>
                        ${refPhotoList ? `
                        <div class="mb-4">
                            <h3 class="text-xs font-bold uppercase text-gray-500 mb-2 border-b pb-1">Reference Photos</h3>
                            ${refPhotoList}
                        </div>` : ''}

                        ${invList ? `
                        <div class="mb-4">
                            <h3 class="text-xs font-bold uppercase text-gray-500 mb-2 border-b pb-1">Materials</h3>
                            <div class="max-h-40 overflow-y-auto">${invList}</div>
                        </div>` : ''}

                        ${feedList ? `
                        <div class="mb-4">
                            <h3 class="text-xs font-bold uppercase text-gray-500 mb-2 border-b pb-1">Calendar Feeds</h3>
                            <div class="max-h-32 overflow-y-auto">${feedList}</div>
                        </div>` : ''}

                        ${attList ? `
                        <div class="mb-4">
                            <h3 class="text-xs font-bold uppercase text-gray-500 mb-2 border-b pb-1">Attachments</h3>
                            <div class="max-h-32 overflow-y-auto">${attList}</div>
                        </div>` : ''}
                    </div>
                </div>

                ${parkingHtml}

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <h3 class="text-xs font-bold uppercase text-gray-500 mb-2 border-b pb-1">People</h3>
                        <div class="space-y-2 text-sm mb-4">
                            <div><span class="text-xs text-gray-400 block">Owners</span>${prop.owner_names || '-'}</div>
                            <div><span class="text-xs text-gray-400 block">Managers</span>${prop.manager_names || '-'}</div>
                        </div>
                    </div>
                </div>

                <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button id="btn-close-read" class="px-4 py-2 text-sm hover:bg-gray-100 rounded">Close</button>
                </div>

                <div class="mt-6 pt-6 border-t border-gray-100">
                    <div id="audit-container-${prop.id}"></div>
                </div>
            </div>
        </div>
    </div>`;

    const safeClose = setupModalGuard('modal-container', () => container.innerHTML = '');
    document.getElementById('btn-close-read').onclick = safeClose;

    document.getElementById('btn-edit-prop').onclick = () => {
        // Close read modal and open edit modal
        container.innerHTML = '';
        openEditModal(prop);
    };

    lucide.createIcons();
    console.log("Calling renderAuditHistory for", prop.id);
    document.getElementById(`audit-container-${prop.id}`).innerHTML = "DEBUG: Starting Audit Fetch...";
    renderAuditHistory(`audit-container-${prop.id}`, 'properties', prop.id);
}

// --- EDIT MODAL ---
async function openEditModal(prop) {
    const container = document.getElementById('modal-container');
    const tenantId = getTenantId();

    const { data: people } = await supabase.from('people').select('id, first_name, last_name, person_roles(roles(name))');
    const { data: templates } = await supabase.from('bom_templates').select('id, name').eq('tenant_id', tenantId).is('deleted_at', null);
    const { data: catalog } = await supabase.from('master_item_catalog').select('*').eq('tenant_id', tenantId);

    let codes = [], feeds = [], inventory = [], refPhotos = [], attachments = [];
    if (prop) {
        const resCodes = await supabase.from('property_access_codes').select('*').eq('property_id', prop.id);
        if (resCodes.data) codes = resCodes.data;

        const resFeeds = await supabase.from('calendar_feeds').select('*').eq('property_id', prop.id);
        if (resFeeds.data) feeds = resFeeds.data;

        const resInv = await supabase.from('property_inventory').select('*').eq('property_id', prop.id);
        if (resInv.data) inventory = resInv.data.map(i => ({ name: i.item_name, qty: i.quantity, category: i.category }));

        // Sort by Order
        const resPhotos = await supabase.from('property_reference_photos').select('*').eq('property_id', prop.id).is('deleted_at', null).order('sort_order');
        if (resPhotos.data) refPhotos = resPhotos.data;

        const resAtt = await supabase.from('property_attachments').select('*').eq('property_id', prop.id).is('deleted_at', null).order('created_at', { ascending: false });
        if (resAtt.data) attachments = resAtt.data;
    }

    const getCode = (t) => { const f = codes.find(c => c.code_type === t); return f ? f.code_value : ''; };

    const title = prop ? 'Edit Property' : 'New Property';
    const valName = prop ? prop.name : '';
    const valAddr = prop ? (prop.display_address || '') : '';
    const valPhoto = prop ? (prop.front_photo_url || '') : '';
    const valCheckin = prop ? (prop.check_in_time || '16:00') : '16:00';
    const valCheckout = prop ? (prop.check_out_time || '11:00') : '11:00';
    const valTZ = prop ? (prop.time_zone || 'UTC') : 'UTC';
    const valDST = prop ? prop.is_dst : false;
    const valCust = prop ? (prop.hcp_customer_id || '') : '';
    const valHcpAddr = prop ? (prop.hcp_address_id || '') : '';

    const valDoor = getCode('Door');
    const valGarage = getCode('Garage');
    const valGate = getCode('Community Gate');
    const valCloset = getCode('Owner Closet');
    const valCasitaCode = getCode('Casita');

    const valWifiName = prop ? (prop.wifi_network || '') : '';
    const valWifiPass = prop ? (prop.wifi_password || '') : '';

    const valBeds = prop ? (prop.bedrooms || 0) : 0;
    const valBaths = prop ? (prop.bathrooms || 0) : 0;
    const valGuests = prop ? (prop.max_guests || 0) : 0;
    const valSqFt = prop ? (prop.square_footage || '') : '';
    const valSinks = prop ? (prop.bathroom_sinks || 0) : 0;
    const valMats = prop ? (prop.bath_mats || 0) : 0;
    const valPool = prop ? prop.has_pool : false;
    const valBBQ = prop ? prop.has_bbq : false;
    const valPets = prop ? prop.allows_pets : false;
    const valCasita = prop ? prop.has_casita : false;
    const valParking = prop ? (prop.parking_instructions || '') : '';

    const photoHtml = valPhoto
        ? `<img src="${valPhoto}" class="w-full h-32 object-cover rounded-lg border border-gray-200 mb-2">`
        : `<div class="w-full h-32 bg-slate-50 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 mb-2"><span class="text-xs">No Photo</span></div>`;

    const isArchived = prop && prop.status === 'archived';
    const deleteBtn = prop
        ? (isArchived
            ? `<button onclick="window.restoreProperty('${prop.id}')" class="text-green-600 hover:text-green-800 font-bold text-sm px-2 flex items-center"><i data-lucide="rotate-ccw" class="w-4 h-4 mr-2"></i> Restore Property</button>`
            : `<button onclick="window.deleteProperty('${prop.id}')" class="text-red-500 hover:text-red-700 font-bold text-sm px-2">Archive Property</button>`)
        : '<div></div>';

    let tmplOpts = '<option value="">Apply Template...</option>';
    if (templates) templates.forEach(t => { tmplOpts += `<option value="${t.id}">${t.name}</option>`; });

    let catalogOpts = '';
    if (catalog) catalog.forEach(c => { catalogOpts += `<option value="${c.item_name}">${c.category}</option>`; });

    container.innerHTML = `
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto flex flex-col md:flex-row gap-6">
            
            <!-- LEFT -->
            <div class="w-full md:w-1/3 space-y-6">
                <div>
                    <label class="block text-xs font-bold uppercase text-gray-500 mb-2">Front Photo</label>
                    <div id="photo-preview-container">${photoHtml}</div>
                    <input type="file" id="inp-file" class="text-xs text-slate-500 file:mr-2 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200">
                    <input type="hidden" id="inp-photo-url" value="${valPhoto}">
                </div>
                
                <div class="bg-slate-50 p-3 rounded border border-slate-100">
                    <label class="block text-xs font-bold uppercase text-gray-500 mb-2">Timings</label>
                    <div class="space-y-2">
                        <div><span class="text-xs text-gray-400 block">Check-in</span><input type="time" id="inp-checkin" class="w-full border p-1 rounded text-sm" value="${valCheckin}"></div>
                        <div><span class="text-xs text-gray-400 block">Check-out</span><input type="time" id="inp-checkout" class="w-full border p-1 rounded text-sm" value="${valCheckout}"></div>
                        <div>
                            <span class="text-xs text-gray-400 block">Time Zone</span>
                            <select id="inp-tz" class="w-full border p-1 rounded text-sm bg-white">
                                <option value="UTC" ${valTZ === 'UTC' ? 'selected' : ''}>UTC</option>
                                <option value="US/Pacific" ${valTZ === 'US/Pacific' ? 'selected' : ''}>US/Pacific</option>
                                <option value="US/Mountain" ${valTZ === 'US/Mountain' ? 'selected' : ''}>US/Mountain</option>
                                <option value="US/Central" ${valTZ === 'US/Central' ? 'selected' : ''}>US/Central</option>
                                <option value="US/Eastern" ${valTZ === 'US/Eastern' ? 'selected' : ''}>US/Eastern</option>
                                <option value="US/Arizona" ${valTZ === 'US/Arizona' ? 'selected' : ''}>US/Arizona</option>
                            </select>
                        </div>
                        <label class="flex items-center gap-2 cursor-pointer pt-1">
                            <input type="checkbox" id="chk-dst" ${valDST ? 'checked' : ''}>
                            <span class="text-xs">Observes DST</span>
                        </label>
                    </div>
                </div>

                <div class="bg-blue-50 p-3 rounded border border-blue-100">
                    <label class="block text-xs font-bold uppercase text-blue-700 mb-2">Specs</label>
                    <div class="grid grid-cols-4 gap-2">
                        <div><span class="text-[10px] text-gray-400 block">Beds</span><input type="number" id="inp-beds" class="w-full border p-1 rounded text-sm" value="${valBeds}" min="0"></div>
                        <div><span class="text-[10px] text-gray-400 block">Baths</span><input type="number" id="inp-baths" class="w-full border p-1 rounded text-sm" value="${valBaths}" step="0.5" min="0"></div>
                        <div><span class="text-[10px] text-gray-400 block">Guests</span><input type="number" id="inp-guests" class="w-full border p-1 rounded text-sm" value="${valGuests}" min="0"></div>
                        <div><span class="text-[10px] text-gray-400 block">Sq Ft</span><input type="number" id="inp-sqft" class="w-full border p-1 rounded text-sm" value="${valSqFt}" min="0"></div>
                        <div><span class="text-[10px] text-gray-400 block">Sinks</span><input type="number" id="inp-sinks" class="w-full border p-1 rounded text-sm" value="${valSinks}" min="0"></div>
                        <div><span class="text-[10px] text-gray-400 block">Mats</span><input type="number" id="inp-mats" class="w-full border p-1 rounded text-sm" value="${valMats}" min="0"></div>
                    </div>
                </div>

                <div class="bg-pink-50 p-3 rounded border border-pink-100">
                    <label class="block text-xs font-bold uppercase text-pink-700 mb-2">Amenities</label>
                    <div class="grid grid-cols-2 gap-2">
                        <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="chk-pool" ${valPool ? 'checked' : ''}><span class="text-xs">Has Pool</span></label>
                        <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="chk-bbq" ${valBBQ ? 'checked' : ''}><span class="text-xs">Has BBQ</span></label>
                        <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="chk-pets" ${valPets ? 'checked' : ''}><span class="text-xs">Pets Allowed</span></label>
                        <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" id="chk-casita" ${valCasita ? 'checked' : ''}><span class="text-xs">Has Casita</span></label>
                    </div>
                </div>

                <!-- REF PHOTOS -->
                <div class="bg-orange-50 p-3 rounded border border-orange-100">
                    <div class="flex justify-between items-center mb-2">
                        <label class="block text-xs font-bold uppercase text-orange-700">Reference Photos</label>
                        <label class="cursor-pointer bg-orange-200 hover:bg-orange-300 text-orange-800 px-2 py-1 rounded text-xs font-bold flex items-center">
                            <i data-lucide="upload" class="w-3 h-3 mr-1"></i> Add
                            <input type="file" id="inp-ref-files" class="hidden" multiple accept="image/*">
                        </label>
                    </div>
                    <div id="ref-photos-container" class="space-y-2"></div>
                </div>
            </div>

            <!-- RIGHT -->
            <div class="w-full md:w-2/3 space-y-4">
                <div class="flex justify-between items-center">
                    <h3 class="font-bold text-lg text-slate-900 ${isArchived ? 'line-through decoration-red-500' : ''}">${title}</h3>
                    ${isArchived ? '<span class="bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-bold uppercase">Archived</span>' : ''}
                </div>
                
                <input id="inp-name" class="w-full border p-2 rounded" placeholder="Property Name" value="${valName}">
                
                <div class="flex gap-2">
                    <select id="sel-country" class="border p-2 rounded bg-white text-sm"><option value="us">🇺🇸</option><option value="ca">🇨🇦</option></select>
                    <div class="relative flex-1">
                        <input id="inp-addr" class="w-full border p-2 rounded" placeholder="Full Address" value="${valAddr}">
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-bold uppercase text-gray-500 mb-1">Parking Instructions</label>
                    <textarea id="inp-parking" class="w-full border p-2 rounded text-sm h-20 resize-none" placeholder="Enter parking details...">${valParking}</textarea>
                </div>

                <div class="bg-yellow-50 p-4 rounded border border-yellow-100">
                    <label class="block text-xs font-bold uppercase text-yellow-700 mb-3">Access Codes</label>
                    <div class="grid grid-cols-2 gap-4">
                        <div><span class="text-[10px] uppercase text-gray-500 font-bold">Front Door</span><input id="code-door" class="w-full border p-2 rounded text-sm font-mono bg-white" value="${valDoor}"></div>
                        <div><span class="text-[10px] uppercase text-gray-500 font-bold">Garage</span><input id="code-garage" class="w-full border p-2 rounded text-sm font-mono bg-white" value="${valGarage}"></div>
                        <div><span class="text-[10px] uppercase text-gray-500 font-bold">Comm. Gate</span><input id="code-gate" class="w-full border p-2 rounded text-sm font-mono bg-white" value="${valGate}"></div>
                        <div><span class="text-[10px] uppercase text-gray-500 font-bold">Owner Closet</span><input id="code-closet" class="w-full border p-2 rounded text-sm font-mono bg-white" value="${valCloset}"></div>
                        <div><span class="text-[10px] uppercase text-gray-500 font-bold text-purple-600">Casita Code</span><input id="code-casita" class="w-full border p-2 rounded text-sm font-mono bg-white" value="${valCasitaCode}"></div>
                    </div>
                </div>

                <div class="bg-indigo-50 p-4 rounded border border-indigo-100">
                    <label class="block text-xs font-bold uppercase text-indigo-700 mb-3">Wifi Details</label>
                    <div class="grid grid-cols-2 gap-4">
                        <div><span class="text-[10px] uppercase text-gray-500 font-bold">Network Name</span><input id="inp-wifi-name" class="w-full border p-2 rounded text-sm bg-white" value="${valWifiName}"></div>
                        <div><span class="text-[10px] uppercase text-gray-500 font-bold">Password</span><input id="inp-wifi-pass" class="w-full border p-2 rounded text-sm bg-white" value="${valWifiPass}"></div>
                    </div>
                </div>

                <div class="bg-green-50 p-4 rounded border border-green-100">
                    <div class="flex justify-between items-center mb-3">
                        <label class="block text-xs font-bold uppercase text-green-700">Inventory (BOM)</label>
                        <div class="flex gap-2">
                            <select id="sel-template" class="border border-green-200 p-1 rounded text-xs bg-white w-32">${tmplOpts}</select>
                            <button id="btn-apply-tmpl" class="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold hover:bg-green-700">Add</button>
                        </div>
                    </div>
                    <div class="flex gap-2 mb-2">
                        <input list="catalog-list" id="inv-single-name" class="flex-1 border p-1 rounded text-xs" placeholder="Search Master Catalog...">
                        <datalist id="catalog-list">${catalogOpts}</datalist>
                        <input type="number" id="inv-single-qty" class="w-12 border p-1 rounded text-xs text-center" value="1">
                        <button id="btn-add-single" class="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 rounded"><i data-lucide="plus" class="w-3 h-3"></i></button>
                    </div>
                    <div id="inventory-container" class="bg-white border border-green-100 rounded p-2 max-h-40 overflow-y-auto space-y-1"></div>
                </div>

                <div class="bg-blue-50 p-4 rounded border border-blue-100">
                    <label class="block text-xs font-bold uppercase text-blue-700 mb-3">Calendar Sync (iCal)</label>
                    <div id="feeds-container" class="space-y-2"></div>
                    <button id="btn-add-feed" class="mt-3 text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                        <i data-lucide="plus-circle" class="w-3 h-3"></i> Add Feed
                    </button>
                </div>

                <div class="grid grid-cols-2 gap-3 pt-2">
                    <div><label class="block text-xs font-bold uppercase text-gray-500 mb-1">Owners <span class="text-red-500">*</span></label><div id="list-owners" class="h-32 overflow-y-auto border border-gray-200 bg-white rounded p-2 space-y-1"></div></div>
                    <div><label class="block text-xs font-bold uppercase text-gray-500 mb-1">Property Managers <span class="text-red-500">*</span></label><div id="list-managers" class="h-32 overflow-y-auto border border-gray-200 bg-white rounded p-2 space-y-1"></div></div>
                </div>

                <div class="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
                    <input id="inp-cust" class="border p-2 rounded text-xs text-gray-400" placeholder="HCP Cust ID" value="${valCust}">
                    <input id="inp-hcp-addr" class="border p-2 rounded text-xs text-gray-400" placeholder="HCP Addr ID" value="${valHcpAddr}">
                </div>

                <div class="flex justify-between pt-4 mt-2 border-t border-gray-100">
                    ${deleteBtn}
                    <div class="flex gap-2">
                        <button id="btn-cancel" class="px-4 py-2 text-sm hover:bg-gray-100 rounded">Cancel</button>
                        <button id="btn-save" class="bg-black text-white px-6 py-2 rounded text-sm font-bold hover:bg-gray-800">Save Property</button>
                    </div>
                </div>
                <div class="bg-gray-50 p-3 rounded border border-gray-100">
                    <div class="flex justify-between items-center mb-2">
                        <label class="block text-xs font-bold uppercase text-gray-600">Attachments</label>
                        <label class="cursor-pointer bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-1 rounded text-xs font-bold flex items-center">
                            <i data-lucide="upload" class="w-3 h-3 mr-1"></i> Upload
                            <input type="file" id="inp-att-files" class="hidden" multiple>
                        </label>
                    </div>
                    <div id="att-container" class="space-y-1"></div>
                </div>
            </div>
        </div>
    </div>`;

    const safeClose = setupModalGuard('modal-container', () => container.innerHTML = '');
    document.getElementById('btn-cancel').onclick = safeClose;

    // --- ATTACHMENTS ---
    const renderAttachments = () => {
        const div = document.getElementById('att-container');
        if (!div) return;
        if (attachments.length === 0) { div.innerHTML = '<div class="text-center text-gray-300 text-xs italic">No attachments.</div>'; return; }
        div.innerHTML = attachments.map(a => `
            <div class="flex justify-between items-center bg-white p-2 rounded border border-gray-200">
                <a href="${a.public_url}" target="_blank" class="text-xs text-blue-600 hover:underline flex items-center gap-2">
                    <i data-lucide="file" class="w-3 h-3"></i> ${a.file_name}
                </a>
                <button onclick="window.deleteAttachment('${a.id}')" class="text-red-300 hover:text-red-500"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
            </div>
        `).join('');
        lucide.createIcons();
    };
    document.getElementById('inp-att-files').addEventListener('change', async (e) => {
        if (!prop) return alert("Please save the property first before adding attachments.");
        const files = Array.from(e.target.files);
        console.log("Uploading", files.length, "attachments...");
        const propId = prop.id; // Ensure propId is available for the new logic
        for (const file of files) {
            const fileName = `prop_${propId}_att_${Date.now()}_${file.name}`;

            try {
                const publicUrl = await uploadFile(file, fileName);

                const { data: newRow, error: dbErr } = await supabase.from('property_attachments').insert({
                    property_id: propId,
                    file_name: file.name,
                    storage_path: fileName,
                    public_url: publicUrl
                }).select().single();

                if (dbErr) throw dbErr;
                attachments.unshift(newRow); // Add the new row to the local array
            } catch (err) {
                alert("Error uploading attachment: " + err.message);
            }
        }
        renderAttachments();
    });
    window.deleteAttachment = async (id) => {
        if (!confirm("Remove attachment?")) return;
        await supabase.from('property_attachments').update({ deleted_at: new Date().toISOString() }).eq('id', id);
        attachments = attachments.filter(a => a.id !== id);
        renderAttachments();
    };
    renderAttachments();

    const listOwners = document.getElementById('list-owners');
    const listManagers = document.getElementById('list-managers');
    const curOwnerIds = prop ? (prop.owner_ids || []) : [];
    const curMgrIds = prop ? (prop.manager_ids || []) : [];
    people.sort((a, b) => a.first_name.localeCompare(b.first_name));
    people.forEach(p => {
        const roles = p.person_roles.map(pr => pr.roles.name);
        const name = `${p.first_name} ${p.last_name || ''}`;
        const cb = (type, checked) => `<label class="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-1 rounded"><input type="checkbox" class="chk-${type}" value="${p.id}" ${checked ? 'checked' : ''}><span class="text-xs">${name}</span></label>`;
        if (roles.includes('Owner')) listOwners.innerHTML += cb('owner', curOwnerIds.includes(p.id));
        if (roles.includes('Property Manager')) listManagers.innerHTML += cb('manager', curMgrIds.includes(p.id));
    });

    // --- REFERENCE PHOTOS ---
    const renderRefPhotos = () => {
        const div = document.getElementById('ref-photos-container');
        if (!div) return;
        if (refPhotos.length === 0) { div.innerHTML = '<div class="text-center text-orange-300 text-xs italic">No references yet.</div>'; return; }

        div.innerHTML = refPhotos.map((p, idx) => `
            <div class="ref-photo-item flex gap-3 items-start bg-white p-2 rounded border border-orange-100 shadow-sm" data-id="${p.id}" data-idx="${idx}">
                <i data-lucide="grip-vertical" class="drag-handle w-4 h-4 text-gray-300 cursor-grab mt-4"></i>
                <a href="${p.public_url}" target="_blank"><img src="${p.public_url}" class="w-12 h-12 rounded object-cover border"></a>
                <div class="flex-1 space-y-1">
                    <textarea class="w-full text-xs border border-gray-100 rounded p-1 focus:border-orange-400 outline-none resize-none h-8" 
                           placeholder="Description (e.g. Bed Setup)" 
                           onchange="window.updateRefPhoto(${p.id}, 'label', this.value)">${p.label || ''}</textarea>
                    <label class="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" class="w-3 h-3 text-orange-500 rounded" 
                               ${p.is_reference ? 'checked' : ''} 
                               onchange="window.updateRefPhoto(${p.id}, 'is_reference', this.checked)">
                        <span class="text-[10px] uppercase font-bold text-gray-500">Reference</span>
                    </label>
                </div>
                <button onclick="window.deleteRefPhoto('${p.id}')" class="text-red-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
        `).join('');
        lucide.createIcons();

        // INIT SORTABLE
        if (Sortable) {
            Sortable.create(div, {
                animation: 150,
                handle: '.drag-handle',
                onEnd: async (evt) => {
                    // Re-calculate Sort Order based on DOM
                    const newOrderIds = Array.from(div.querySelectorAll('.ref-photo-item')).map(el => el.dataset.id);
                    const items = newOrderIds.map((id, idx) => ({ id: id, order: idx }));

                    const { error } = await supabase.rpc('reorder_items', {
                        p_table: 'property_reference_photos',
                        p_id_col: 'id',
                        p_order_col: 'sort_order',
                        p_items: items
                    });

                    if (error) console.error("Reorder failed:", error);
                }
            });
        }
    };

    document.getElementById('inp-ref-files').addEventListener('change', async (e) => {
        if (!prop) return alert("Please save the property first before adding reference photos.");
        const files = Array.from(e.target.files);
        console.log("Uploading", files.length, "files...");
        for (const file of files) {
            const ext = file.name.split('.').pop();
            const path = `prop_${prop.id}_ref_${Date.now()}.${ext}`;

            try {
                const publicUrl = await uploadFile(file, path);

                const { data: newRow, error: dbErr } = await supabase.from('property_reference_photos').insert({
                    property_id: prop.id,
                    storage_path: path,
                    public_url: publicUrl,
                    label: file.name, // Using file.name as initial label
                    sort_order: refPhotos.length // Append to end
                }).select().single();

                if (dbErr) {
                    console.error("DB Insert Failed:", dbErr);
                } else {
                    refPhotos.push(newRow);
                }
            } catch (err) {
                alert("Error uploading: " + err.message);
            }
        }
        renderRefPhotos();
    });

    window.updateRefPhoto = async (id, field, val) => {
        await supabase.from('property_reference_photos').update({ [field]: val }).eq('id', id);
    };
    window.deleteRefPhoto = async (id) => {
        if (!confirm("Remove photo?")) return;
        await supabase.from('property_reference_photos').update({ deleted_at: new Date().toISOString() }).eq('id', id);
        refPhotos = refPhotos.filter(p => p.id !== id);
        renderRefPhotos();
    };
    renderRefPhotos();

    // --- INVENTORY ---
    const invContainer = document.getElementById('inventory-container');
    const renderInventory = () => {
        if (inventory.length === 0) { invContainer.innerHTML = '<div class="text-center text-gray-400 text-xs py-2">No inventory items.</div>'; return; }
        invContainer.innerHTML = inventory.map((item, idx) => `
            <div class="flex justify-between items-center border-b border-gray-50 pb-1 last:border-0">
                <div class="flex items-center gap-2">
                    <input type="number" class="w-10 text-center border rounded text-xs p-0.5 font-bold bg-gray-50 inv-qty" data-idx="${idx}" value="${item.qty}">
                    <span class="text-xs font-medium text-slate-700">${item.name}</span>
                    <span class="text-[10px] text-gray-400 bg-gray-50 px-1 rounded">${item.category || ''}</span>
                </div>
                <button class="text-red-400 hover:text-red-600 p-1 btn-remove-inv" data-idx="${idx}"><i data-lucide="x" class="w-3 h-3"></i></button>
            </div>
        `).join('');
        invContainer.querySelectorAll('.btn-remove-inv').forEach(b => { b.onclick = () => { inventory.splice(b.dataset.idx, 1); renderInventory(); }; });
        invContainer.querySelectorAll('.inv-qty').forEach(i => { i.onchange = (e) => { inventory[i.dataset.idx].qty = parseInt(e.target.value) || 0; }; });
        lucide.createIcons();
    };
    document.getElementById('btn-apply-tmpl').onclick = async () => {
        const tmplId = document.getElementById('sel-template').value;
        if (!tmplId) return;
        const { data: items } = await supabase.from('bom_template_items').select('*').eq('template_id', tmplId);
        if (items) {
            items.forEach(newItem => {
                const existingIdx = inventory.findIndex(i => i.name.toLowerCase() === newItem.item_name.toLowerCase());
                if (existingIdx > -1) inventory[existingIdx].qty += newItem.quantity;
                else inventory.push({ name: newItem.item_name, qty: newItem.quantity, category: newItem.category });
            });
            renderInventory();
        }
    };
    document.getElementById('btn-add-single').onclick = () => {
        const nameInput = document.getElementById('inv-single-name');
        const qtyInput = document.getElementById('inv-single-qty');
        const name = nameInput.value.trim();
        if (!name) return;
        const match = catalog.find(c => c.item_name.toLowerCase() === name.toLowerCase());
        if (!match) return alert("Item must be defined in a BOM Template first.");
        const existingIdx = inventory.findIndex(i => i.name.toLowerCase() === name.toLowerCase());
        if (existingIdx > -1) inventory[existingIdx].qty += parseInt(qtyInput.value) || 1;
        else inventory.push({ name: match.item_name, qty: parseInt(qtyInput.value) || 1, category: match.category });
        nameInput.value = ''; qtyInput.value = '1'; renderInventory();
    };
    renderInventory();

    // --- FEED LOGIC ---
    const feedContainer = document.getElementById('feeds-container');
    const feedTypes = ["Airbnb", "VRBO", "Booking.com", "Guesty", "HomeAway", "Hospitable", "HostTools", "Lodgify", "OwnerRez"];
    const addFeedRow = (name = '', url = '', id = null) => {
        const div = document.createElement('div');
        div.className = "flex gap-2 items-center feed-row";
        div.dataset.id = id || '';
        let opts = '';
        feedTypes.forEach(t => { opts += `<option value="${t}" ${t === name ? 'selected' : ''}>${t}</option>`; });
        div.innerHTML = `<select class="border p-2 rounded text-xs bg-white w-32 feed-type">${opts}</select><input class="flex-1 border p-2 rounded text-xs feed-url" placeholder="https://..." value="${url}"><button class="text-red-400 hover:text-red-600 p-1 btn-remove-feed"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`;
        div.querySelector('.btn-remove-feed').onclick = () => div.remove();
        feedContainer.appendChild(div);
        lucide.createIcons();
    };
    if (feeds.length > 0) feeds.forEach(f => addFeedRow(f.name, f.url, f.id));
    else if (!prop) addFeedRow('Airbnb', '');
    document.getElementById('btn-add-feed').onclick = () => addFeedRow();

    // --- UPLOAD FRONT ---
    document.getElementById('inp-file').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const fileName = `${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
        const { error } = await supabase.storage.from('properties').upload(fileName, file);
        if (error) return alert("Upload Error: " + error.message);
        const { data } = supabase.storage.from('properties').getPublicUrl(fileName);
        const url = data.publicUrl;
        document.getElementById('inp-photo-url').value = url;
        document.getElementById('photo-preview-container').innerHTML = `<img src="${url}" class="w-full h-32 object-cover rounded-lg border border-gray-200 mb-2">`;
    });

    // --- MAPS ---
    // --- ADDRESS AUTOCOMPLETE (PHOTON) ---
    const addrInput = document.getElementById('inp-addr');
    const countrySel = document.getElementById('sel-country');
    let debounceTimer;

    const performSearch = async (query) => {
        if (!query || query.length < 3) return;
        try {
            // Bias towards US/CA based on selection, but Photon doesn't strictly enforce country without filtering results manually
            // We can pass lat/lon bias if we wanted, but for now simple query is fine.
            const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`);
            const data = await res.json();
            showSuggestions(data.features);
        } catch (e) {
            console.error("Address search failed", e);
        }
    };

    const showSuggestions = (features) => {
        // Remove existing dropdown
        const existing = document.getElementById('addr-suggestions');
        if (existing) existing.remove();

        if (!features || features.length === 0) return;

        const div = document.createElement('div');
        div.id = 'addr-suggestions';
        div.className = "absolute z-50 bg-white border border-gray-200 rounded-lg shadow-xl w-full mt-1 max-h-48 overflow-y-auto top-full left-0";

        // Position it relative to input wrapper
        // addrInput.parentNode is now the relative wrapper
        addrInput.parentNode.appendChild(div);

        div.innerHTML = features.map(f => {
            const p = f.properties;
            // Construct address with house number if available
            let streetPart = p.street || p.name || '';
            if (p.housenumber) {
                streetPart = `${p.housenumber} ${streetPart}`;
            }

            const addr = [streetPart, p.city, p.state, p.postcode, p.country].filter(Boolean).join(', ');
            return `<div class="p-2 hover:bg-blue-50 cursor-pointer text-xs border-b border-gray-50 last:border-0" data-val="${addr}">
                <div class="font-bold text-slate-700">${streetPart}</div>
                <div class="text-gray-500">${addr}</div>
            </div>`;
        }).join('');

        div.querySelectorAll('div[data-val]').forEach(el => {
            el.onclick = () => {
                addrInput.value = el.dataset.val;
                div.remove();
            };
        });

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!div.contains(e.target) && e.target !== addrInput) div.remove();
        }, { once: true });
    };

    addrInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => performSearch(e.target.value), 400);
    });

    // --- SAVE ---
    document.getElementById('btn-save').onclick = async () => {
        const name = document.getElementById('inp-name').value;
        if (!name) return alert("Name required");

        const feedRows = document.querySelectorAll('.feed-row');
        const feedsData = Array.from(feedRows).map(row => ({
            id: row.dataset.id ? row.dataset.id : null,
            name: row.querySelector('.feed-type').value,
            url: row.querySelector('.feed-url').value.trim()
        })).filter(f => f.url.length > 0);

        const ownerIds = Array.from(document.querySelectorAll('.chk-owner:checked')).map(cb => cb.value);
        const mgrIds = Array.from(document.querySelectorAll('.chk-manager:checked')).map(cb => cb.value);

        if (ownerIds.length === 0) return alert("At least one Owner is required.");
        if (mgrIds.length === 0) return alert("At least one Property Manager is required.");

        const payload = {
            p_tenant_id: getTenantId(),
            p_name: name,
            p_address: document.getElementById('inp-addr').value,
            p_hcp_cust: document.getElementById('inp-cust').value,
            p_hcp_addr: document.getElementById('inp-hcp-addr').value,
            p_checkin: document.getElementById('inp-checkin').value,
            p_checkout: document.getElementById('inp-checkout').value,
            p_time_zone: document.getElementById('inp-tz').value,
            p_is_dst: document.getElementById('chk-dst').checked,
            p_owner_ids: ownerIds,
            p_manager_ids: mgrIds,
            p_photo_url: document.getElementById('inp-photo-url').value,
            p_door_code: document.getElementById('code-door').value,
            p_garage_code: document.getElementById('code-garage').value,
            p_gate_code: document.getElementById('code-gate').value,
            p_closet_code: document.getElementById('code-closet').value,
            p_wifi_network: document.getElementById('inp-wifi-name').value,
            p_wifi_password: document.getElementById('inp-wifi-pass').value,
            p_bedrooms: parseInt(document.getElementById('inp-beds').value) || 0,
            p_bathrooms: parseFloat(document.getElementById('inp-baths').value) || 0,
            p_max_guests: parseInt(document.getElementById('inp-guests').value) || 0,
            p_square_footage: parseInt(document.getElementById('inp-sqft').value) || 0,
            p_bathroom_sinks: parseInt(document.getElementById('inp-sinks').value) || 0,
            p_bath_mats: parseInt(document.getElementById('inp-mats').value) || 0,
            p_has_pool: document.getElementById('chk-pool').checked,
            p_has_bbq: document.getElementById('chk-bbq').checked,
            p_allows_pets: document.getElementById('chk-pets').checked,
            p_has_casita: document.getElementById('chk-casita').checked,
            p_casita_code: document.getElementById('code-casita').value,
            p_parking_instructions: document.getElementById('inp-parking').value,
            p_feeds: feedsData,
            p_inventory: inventory
        };

        let err = null;
        if (prop) {
            const { error } = await supabase.rpc('update_property_safe', { ...payload, p_id: prop.id });
            err = error;
        } else {
            const { error } = await supabase.rpc('create_property_safe', { ...payload });
            err = error;
        }

        if (err) alert("Error: " + err.message);
        else {
            container.innerHTML = '';
            loadTableData();
        }
    };
}

window.deleteProperty = async (id) => {
    if (prompt("Type ARCHIVE to confirm:") !== 'ARCHIVE') return;
    await supabase.rpc('delete_property_safe', { p_id: id });
    document.getElementById('modal-container').innerHTML = '';
    loadTableData(document.getElementById('chk-show-archived')?.checked);
};

window.restoreProperty = async (id) => {
    if (!confirm("Restore this property?")) return;
    const { error } = await supabase.from('properties').update({ status: 'active' }).eq('id', id);
    if (error) alert("Error: " + error.message);
    else {
        document.getElementById('modal-container').innerHTML = '';
        loadTableData(document.getElementById('chk-show-archived')?.checked);
    }
};
