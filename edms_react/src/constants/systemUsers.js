export const SYSTEM_USERS = [
  {
    id: 'initiator',
    order: 1,
    role: 'Initiator',
    name: 'Md. Arman Hossen',
    designation: 'Senior Officer (IT)',
    avatar: 'AH',
    color: '#0284c7',
    bgLight: '#e0f2fe',
    label: '১. Initiator (Md. Arman Hossen)',
    nextRole: 'Head of Department',
    deskName: 'Initiator Desk'
  },
  {
    id: 'checker',
    order: 2,
    role: 'Checker',
    name: 'Rahul Acharjee',
    designation: 'Officer IT (Technical Checker)',
    avatar: 'RA',
    color: '#059669',
    bgLight: '#d1fae5',
    label: 'Checker / Reviewer (Rahul Acharjee)',
    nextRole: 'Head of Department',
    deskName: 'Checker Desk'
  },
  {
    id: 'hod',
    order: 3,
    role: 'Head of Department',
    name: 'Engr. Dilip K Roy',
    designation: 'Head of IT & Department',
    avatar: 'ER',
    color: '#0b7337',
    bgLight: '#dcfce7',
    label: '২. Head of Department (Engr. Dilip K Roy)',
    nextRole: 'Accounts & Finance',
    deskName: 'Head of Department'
  },
  {
    id: 'accounts',
    order: 4,
    role: 'Accounts & Finance',
    name: 'CFO / Chief Accounts Officer',
    designation: 'Chief Accounts Officer',
    avatar: 'CA',
    color: '#d97706',
    bgLight: '#fef3c7',
    label: '৩. Accounts & Finance (CFO / Chief Accounts Officer)',
    nextRole: 'Secretary General',
    deskName: 'Accounts & Finance'
  },
  {
    id: 'sg',
    order: 5,
    role: 'Secretary General',
    name: 'Secretary General (SG)',
    designation: 'Secretary General / মহাসচিব',
    avatar: 'SG',
    color: '#7c3aed',
    bgLight: '#f3e8ff',
    label: '৪. Secretary General (SG / মহাসচিব)',
    nextRole: 'President',
    deskName: 'Secretary General'
  },
  {
    id: 'president',
    order: 6,
    role: 'President',
    name: 'President of DCCI',
    designation: 'মাননীয় সভাপতি, DCCI (চূড়ান্ত অনুমোদন)',
    avatar: 'PR',
    color: '#dc2626',
    bgLight: '#fee2e2',
    label: '৫. President, DCCI (মাননীয় সভাপতি - চূড়ান্ত অনুমোদন)',
    nextRole: 'Complete',
    deskName: 'President Approval'
  }
];

export const DEFAULT_USER = SYSTEM_USERS[2]; // Default: Engr. Dilip K Roy (Head of Department)
