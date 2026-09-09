export function normalizeRole(role) {
    const r = String(role || '').trim().toLowerCase();
    if (r === 'garage' || r === 'service_center' || r === 'servicecenter' || r === 'service center') return 'GARAGE';
    if (r === 'vehicle_owner' || r === 'vehicle owner' || r === 'user' || r === 'customer' || r === 'owner') return 'USER';
    if (r === 'admin' || r === 'administrator') return 'ADMIN';
    return role || 'USER';
}
