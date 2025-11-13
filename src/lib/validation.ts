export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  if (!phone) return true;
  const phoneRegex = /^[\d\s\+\-\(\)\.]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

export function validateUrl(url: string): boolean {
  if (!url) return true;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateRequired(value: string | number | null | undefined): boolean {
  if (typeof value === 'number') return true;
  return Boolean(value && value.toString().trim().length > 0);
}

export function validateMinLength(value: string, min: number): boolean {
  return value.trim().length >= min;
}

export function validateMaxLength(value: string, max: number): boolean {
  return value.trim().length <= max;
}

export function validateNumber(value: string | number): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && isFinite(num);
}

export function validatePositiveNumber(value: string | number): boolean {
  if (!validateNumber(value)) return false;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num > 0;
}

export function validateDateInFuture(date: string | Date): boolean {
  const inputDate = typeof date === 'string' ? new Date(date) : date;
  return inputDate > new Date();
}

export interface CampaignFormData {
  title: string;
  objective_amount: number;
  location: string;
  deadline?: string;
}

export function validateCampaignForm(data: CampaignFormData): ValidationResult {
  const errors: Record<string, string> = {};

  if (!validateRequired(data.title)) {
    errors.title = 'Le titre est requis';
  } else if (!validateMinLength(data.title, 3)) {
    errors.title = 'Le titre doit contenir au moins 3 caractères';
  } else if (!validateMaxLength(data.title, 100)) {
    errors.title = 'Le titre ne peut pas dépasser 100 caractères';
  }

  if (!validateRequired(data.objective_amount)) {
    errors.objective_amount = 'L\'objectif financier est requis';
  } else if (!validatePositiveNumber(data.objective_amount)) {
    errors.objective_amount = 'L\'objectif doit être un nombre positif';
  }

  if (!validateRequired(data.location)) {
    errors.location = 'La localisation est requise';
  } else if (!validateMinLength(data.location, 2)) {
    errors.location = 'La localisation doit contenir au moins 2 caractères';
  }

  if (data.deadline && !validateDateInFuture(data.deadline)) {
    errors.deadline = 'La date limite doit être dans le futur';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export interface SponsorFormData {
  email: string;
  name?: string;
  company?: string;
  phone?: string;
}

export function validateSponsorForm(data: SponsorFormData): ValidationResult {
  const errors: Record<string, string> = {};

  if (!validateRequired(data.email)) {
    errors.email = 'L\'email est requis';
  } else if (!validateEmail(data.email)) {
    errors.email = 'Veuillez entrer une adresse email valide';
  }

  if (data.name && !validateMinLength(data.name, 2)) {
    errors.name = 'Le nom doit contenir au moins 2 caractères';
  }

  if (data.company && !validateMinLength(data.company, 2)) {
    errors.company = 'Le nom de l\'entreprise doit contenir au moins 2 caractères';
  }

  if (data.phone && !validatePhone(data.phone)) {
    errors.phone = 'Veuillez entrer un numéro de téléphone valide';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export interface PledgeResponseData {
  email: string;
  name: string;
  company?: string;
  phone?: string;
  amount?: number;
  comment?: string;
}

export function validatePledgeResponse(data: PledgeResponseData): ValidationResult {
  const errors: Record<string, string> = {};

  if (!validateRequired(data.email)) {
    errors.email = 'L\'email est requis';
  } else if (!validateEmail(data.email)) {
    errors.email = 'Veuillez entrer une adresse email valide';
  }

  if (!validateRequired(data.name)) {
    errors.name = 'Le nom est requis';
  } else if (!validateMinLength(data.name, 2)) {
    errors.name = 'Le nom doit contenir au moins 2 caractères';
  }

  if (data.phone && !validatePhone(data.phone)) {
    errors.phone = 'Veuillez entrer un numéro de téléphone valide';
  }

  if (data.amount !== undefined && data.amount !== null) {
    if (!validateNumber(data.amount)) {
      errors.amount = 'Le montant doit être un nombre valide';
    } else if (data.amount < 0) {
      errors.amount = 'Le montant ne peut pas être négatif';
    }
  }

  if (data.comment && data.comment.length > 500) {
    errors.comment = 'Le commentaire ne peut pas dépasser 500 caractères';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function getErrorMessage(field: string, errors: Record<string, string>): string | null {
  return errors[field] || null;
}

export function hasError(field: string, errors: Record<string, string>): boolean {
  return Boolean(errors[field]);
}
