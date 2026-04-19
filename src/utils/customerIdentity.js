export function getCustomerId(entity) {
  if (entity == null) {
    return '';
  }

  if (typeof entity === 'string' || typeof entity === 'number') {
    return String(entity).trim();
  }

  if (typeof entity !== 'object') {
    return '';
  }

  const directKeys = [
    'id',
    'customerId',
    'customer_id',
    'customerID',
    'customerUuid',
    'customer_uuid',
  ];

  for (const key of directKeys) {
    if (entity[key] !== undefined && entity[key] !== null && String(entity[key]).trim()) {
      return String(entity[key]).trim();
    }
  }

  const nestedKeys = ['customer', 'profile', 'user', 'data', 'attributes', 'result'];
  for (const key of nestedKeys) {
    const nested = getCustomerId(entity[key]);
    if (nested) {
      return nested;
    }
  }

  return '';
}

export function getCustomerDisplayName(entity) {
  if (!entity) {
    return '';
  }

  if (typeof entity === 'string' || typeof entity === 'number') {
    return String(entity).trim();
  }

  if (typeof entity !== 'object') {
    return '';
  }

  const directFields = [
    entity.customerName,
    entity.customer_name,
    entity.full_name,
    entity.fullName,
    entity.displayName,
    entity.display_name,
    entity.preferredName,
    entity.preferred_name,
    entity.name,
    entity.firstName,
    entity.first_name,
    entity.lastName,
    entity.last_name,
    entity.givenName,
    entity.given_name,
    entity.nickname,
  ];

  const directMatch = directFields.find((value) => typeof value === 'string' && value.trim());
  if (directMatch) {
    return directMatch.trim();
  }

  const composite = [entity.firstName || entity.first_name, entity.lastName || entity.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (composite) {
    return composite;
  }

  const nestedKeys = ['customer', 'profile', 'user', 'data', 'attributes', 'result'];
  for (const key of nestedKeys) {
    const nested = getCustomerDisplayName(entity[key]);
    if (nested) {
      return nested;
    }
  }

  return '';
}

export function getCustomerPhone(entity) {
  if (!entity) {
    return '';
  }

  if (typeof entity === 'string' || typeof entity === 'number') {
    return String(entity).trim();
  }

  if (typeof entity !== 'object') {
    return '';
  }

  const directFields = [
    entity.customerPhone,
    entity.customer_phone,
    entity.phone,
    entity.phone_number,
    entity.mobile,
    entity.mobile_number,
  ];

  const directMatch = directFields.find((value) => typeof value === 'string' && value.trim());
  if (directMatch) {
    return directMatch.trim();
  }

  const nestedKeys = ['customer', 'profile', 'user', 'data', 'attributes', 'result'];
  for (const key of nestedKeys) {
    const nested = getCustomerPhone(entity[key]);
    if (nested) {
      return nested;
    }
  }

  return '';
}

export function getCustomerInitial(entity) {
  const name = getCustomerDisplayName(entity);
  return name ? name.charAt(0).toUpperCase() : 'G';
}
