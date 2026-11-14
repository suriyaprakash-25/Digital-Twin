import { describe, expect, it } from 'vitest';
import { ROLES, hasRole, homePathForRole, normalizePublicRole, normalizeRole } from './roles';

describe('normalizeRole (mirrors backend/src/middleware/auth.js)', () => {
  it.each([
    ['garage', ROLES.GARAGE],
    ['GARAGE', ROLES.GARAGE],
    ['service_center', ROLES.GARAGE],
    ['servicecenter', ROLES.GARAGE],
    ['service centre', ROLES.GARAGE],
    ['Service Center', ROLES.GARAGE],
    ['  garage  ', ROLES.GARAGE],
    ['vehicle_owner', ROLES.USER],
    ['vehicle owner', ROLES.USER],
    ['user', ROLES.USER],
    ['customer', ROLES.USER],
    ['owner', ROLES.USER],
    ['admin', ROLES.ADMIN],
    ['Administrator', ROLES.ADMIN],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeRole(input)).toBe(expected);
  });

  it('defaults empty roles to USER and passes unknown roles through', () => {
    expect(normalizeRole(undefined)).toBe(ROLES.USER);
    expect(normalizeRole('')).toBe(ROLES.USER);
    expect(normalizeRole('SUPPORT')).toBe('SUPPORT');
  });

  it('does not treat prototype keys as aliases', () => {
    expect(normalizeRole('constructor')).toBe('constructor');
  });
});

describe('normalizePublicRole', () => {
  it('can never produce ADMIN', () => {
    expect(normalizePublicRole('admin')).toBe(ROLES.USER);
    expect(normalizePublicRole('garage')).toBe(ROLES.GARAGE);
    expect(normalizePublicRole('anything')).toBe(ROLES.USER);
  });
});

describe('hasRole / homePathForRole', () => {
  it('compares normalised roles', () => {
    expect(hasRole('service centre', [ROLES.GARAGE])).toBe(true);
    expect(hasRole('customer', [ROLES.GARAGE])).toBe(false);
    expect(hasRole('customer', [])).toBe(true);
  });

  it('maps each role to its home page', () => {
    expect(homePathForRole('administrator')).toBe('/admin');
    expect(homePathForRole('service_center')).toBe('/garage-dashboard');
    expect(homePathForRole('owner')).toBe('/user-dashboard');
  });
});
