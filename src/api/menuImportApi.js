import { apiRequest } from './client.js';
import { getKitchenRestaurantId } from '../services/authStorage.js';

function resolveRestaurantId(explicitRestaurantId) {
  const resolved = String(explicitRestaurantId || getKitchenRestaurantId() || '').trim();
  return resolved || null;
}

function createUploadPayload(file, restaurantId) {
  const formData = new FormData();
  formData.append('restaurantId', restaurantId);
  formData.append('file', file);
  return formData;
}

export function uploadAndOcrMenu(file, restaurantId) {
  if (!file) {
    throw new Error('file is required');
  }

  const resolvedRestaurantId = resolveRestaurantId(restaurantId);
  if (!resolvedRestaurantId) {
    throw new Error('restaurantId is required');
  }

  return apiRequest('/menu-imports/upload-and-ocr', {
    method: 'POST',
    body: createUploadPayload(file, resolvedRestaurantId),
  });
}

export function parseMenuImport(importId) {
  const resolvedImportId = String(importId || '').trim();
  if (!resolvedImportId) {
    throw new Error('importId is required');
  }

  return apiRequest(`/menu-imports/${encodeURIComponent(resolvedImportId)}/parse`, {
    method: 'POST',
  });
}

export function reparseMenuImport(importId) {
  const resolvedImportId = String(importId || '').trim();
  if (!resolvedImportId) {
    throw new Error('importId is required');
  }

  // TODO: confirm backend exposes POST /api/menu-imports/:id/reparse in all environments.
  return apiRequest(`/menu-imports/${encodeURIComponent(resolvedImportId)}/reparse`, {
    method: 'POST',
  });
}

export function approveMenuImport(importId, parsedJson) {
  const resolvedImportId = String(importId || '').trim();
  if (!resolvedImportId) {
    throw new Error('importId is required');
  }

  return apiRequest(`/menu-imports/${encodeURIComponent(resolvedImportId)}/approve`, {
    method: 'POST',
    body: { parsedJson },
  });
}

export function getMenuImport(importId) {
  const resolvedImportId = String(importId || '').trim();
  if (!resolvedImportId) {
    throw new Error('importId is required');
  }

  return apiRequest(`/menu-imports/${encodeURIComponent(resolvedImportId)}`);
}
