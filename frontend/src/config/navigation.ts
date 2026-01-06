export interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  requiredRoles: string[];
  requiredPermissions: string[];
  children?: NavigationItem[];
}

export interface NavigationGroup {
  id: string;
  label: string;
  icon: string;
  items: NavigationItem[];
  requiredRoles: string[];
  requiredPermissions: string[];
}

// Base navigation groups that are always available
export const baseNavigationGroups: NavigationGroup[] = [
  {
    id: 'dashboards',
    label: 'Dashboards',
    icon: 'LayoutDashboard',
    requiredRoles: ['owner', 'clinic_admin', 'admin', 'doctor', 'reception', 'receptionist', 'patient', 'user', 'billing'],
    requiredPermissions: [],
    items: [
      {
        id: 'doctor-dashboard',
        label: 'Doctor Dashboard',
        icon: 'Stethoscope',
        path: '/dashboard/doctor',
        requiredRoles: ['doctor'],
        requiredPermissions: []
      },
      {
        id: 'reception-dashboard',
        label: 'Reception Dashboard',
        icon: 'ClipboardList',
        path: '/dashboard/reception',
        requiredRoles: ['owner', 'clinic_admin', 'admin', 'reception', 'receptionist'],
        requiredPermissions: []
      },
      {
        id: 'patient-dashboard',
        label: 'My Appointments',
        icon: 'User',
        path: '/dashboard/patient',
        requiredRoles: ['patient', 'user', 'owner', 'clinic_admin', 'admin', 'doctor', 'reception', 'receptionist'],
        requiredPermissions: []
      },
      {
        id: 'billing-dashboard',
        label: 'Billing Dashboard',
        icon: 'CreditCard',
        path: '/dashboard/billing',
        requiredRoles: ['owner', 'clinic_admin', 'admin', 'billing'],
        requiredPermissions: []
      }
    ]
  }
];

// HCP-specific navigation groups (only shown when HCP is registered)
export const hcpNavigationGroups: NavigationGroup[] = [
  {
    id: 'hcp-setup',
    label: 'HCP Management',
    icon: 'Building2',
    requiredRoles: ['owner', 'clinic_admin', 'admin'],
    requiredPermissions: [],
    items: [
      {
        id: 'hcp-list',
        label: 'Healthcare Providers',
        icon: 'Building2',
        path: '/hcp',
        requiredRoles: ['owner', 'clinic_admin', 'admin'],
        requiredPermissions: []
      }
    ]
  },
  {
    id: 'appointments',
    label: 'Appointments',
    icon: 'Calendar',
    requiredRoles: ['owner', 'clinic_admin', 'admin', 'reception', 'receptionist', 'doctor', 'patient', 'user'],
    requiredPermissions: [],
    items: [
      {
        id: 'appointments-main',
        label: 'Appointments',
        icon: 'Calendar',
        path: '/appointments',
        requiredRoles: ['owner', 'clinic_admin', 'admin', 'reception', 'receptionist', 'doctor', 'patient', 'user'],
        requiredPermissions: []
      }
    ]
  },
  {
    id: 'patient-management',
    label: 'Patient Mgmt.',
    icon: 'User',
    requiredRoles: ['owner', 'clinic_admin', 'admin', 'reception', 'receptionist'],
    requiredPermissions: [],
    items: [
      {
        id: 'patient-registration',
        label: 'Register Patient',
        icon: 'UserPlus',
        path: '/patients/register',
        requiredRoles: ['owner', 'clinic_admin', 'admin', 'reception', 'receptionist'],
        requiredPermissions: []
      },
      {
        id: 'patient-list',
        label: 'All Patients',
        icon: 'Users',
        path: '/patients',
        requiredRoles: ['owner', 'clinic_admin', 'admin', 'reception', 'receptionist'],
        requiredPermissions: []
      },
      {
        id: 'patient-search',
        label: 'Search Patients',
        icon: 'Search',
        path: '/patients/search',
        requiredRoles: ['owner', 'clinic_admin', 'admin', 'reception', 'receptionist'],
        requiredPermissions: []
      }
    ]
  }
];

// Role hierarchy for permission checking (Admin > Owner > Clinic Admin > Doctor > Receptionist > Billing > Patient > Guest)
const roleHierarchy: { [key: string]: string[] } = {
  'admin': ['admin', 'owner', 'clinic_admin', 'doctor', 'reception', 'receptionist', 'billing', 'patient', 'user', 'guest'],
  'owner': ['owner', 'clinic_admin', 'doctor', 'reception', 'receptionist', 'billing', 'patient', 'user', 'guest'],
  'clinic_admin': ['clinic_admin', 'doctor', 'reception', 'receptionist', 'billing', 'patient', 'user', 'guest'],
  'doctor': ['doctor', 'patient', 'user'],
  'reception': ['reception', 'receptionist', 'patient', 'user'],
  'receptionist': ['receptionist', 'patient', 'user'],
  'billing': ['billing', 'patient', 'user'],
  'patient': ['patient', 'user'],
  'user': ['user'],
  'guest': ['guest']
};

// Permission mappings
const permissions: { [key: string]: string[] } = {
  // Dashboard permissions
  'view_doctor_dashboard': ['owner', 'doctor'],
  'view_reception_dashboard': ['owner', 'reception', 'receptionist'],
  'view_patient_dashboard': ['owner', 'patient', 'user', 'guest', 'doctor', 'reception', 'receptionist'],
  'view_billing_dashboard': ['owner', 'billing'],
  
  // Master data permissions
  'view_clinics': ['owner', 'doctor', 'reception', 'receptionist', 'billing'],
  'view_practices': ['owner', 'doctor', 'reception', 'receptionist', 'billing'],
  'view_doctors': ['owner', 'doctor', 'reception', 'receptionist'],
  'view_services': ['owner', 'doctor', 'reception', 'receptionist', 'billing'],
  
  // Appointment permissions
  'book_appointments': ['owner', 'reception', 'receptionist', 'patient', 'user'],
  'manage_appointments': ['owner', 'doctor', 'reception', 'receptionist'],
  'view_appointments': ['owner', 'doctor', 'reception', 'receptionist', 'patient', 'user'],
  'view_appointment_history': ['owner', 'doctor', 'reception', 'receptionist', 'patient', 'user'],
  
  // Medical record permissions
  'view_patient_records': ['owner', 'doctor'],
  'view_own_data': ['owner', 'patient', 'user'],
  'view_medical_records': ['owner', 'patient', 'user'],
  'view_prescriptions': ['owner', 'doctor', 'patient', 'user'],
  
  // Billing permissions
  'view_invoices': ['owner', 'billing', 'reception', 'receptionist'],
  'manage_payments': ['owner', 'billing', 'reception', 'receptionist'],
  'view_billing_reports': ['owner', 'billing'],
  
  // System permissions
  'manage_users': ['owner'],
  'manage_system': ['owner'],
  'manage_patients': ['owner', 'reception', 'receptionist'],
  'manage_clinics': ['owner'],
  'manage_practices': ['owner']
};

export function hasAccess(userRoles: string[], userPermissions: string[], requiredRoles: string[], requiredPermissions: string[]): boolean {
  // Check if user has any of the required roles (considering hierarchy)
  const hasRequiredRole = requiredRoles.some(role => 
    userRoles.some(userRole => 
      roleHierarchy[userRole]?.includes(role)
    )
  );
  
  // Check if user has any of the required permissions
  const hasRequiredPermission = requiredPermissions.length === 0 || 
    requiredPermissions.some(permission => userPermissions.includes(permission));
  
  const hasAccess = hasRequiredRole && hasRequiredPermission;
  
  // Debug logging
  if (!hasAccess) {
    console.log('❌ [ACCESS DENIED]', {
      requiredRoles,
      requiredPermissions,
      userRoles,
      hasRequiredRole,
      hasRequiredPermission
    });
  }
  
  return hasAccess;
}

// Helper function to get accessible navigation groups based on user roles, permissions, and HCP status
export function getAccessibleNavigationGroups(
  userRoles: string[], 
  userPermissions: string[],
  hasHCP: boolean = false
): NavigationGroup[] {
  let groups: NavigationGroup[] = [];
  
  // Determine which groups to show based on HCP status and user roles/permissions
  const isOwner = userRoles.includes('owner');
  const isClinicAdmin = userRoles.includes('clinic_admin');
  const isAdmin = userRoles.includes('admin');
  const hasHCPManagePermission = userPermissions.includes('manage_hcp');
  const canManageHCP = isOwner || isClinicAdmin || isAdmin || hasHCPManagePermission;
  const isStaff = userRoles.some(role => ['doctor', 'reception', 'receptionist', 'billing'].includes(role));
  
  if (hasHCP) {
    // If HCP is registered, show HCP-specific groups first, then base groups
    groups = [...hcpNavigationGroups, ...baseNavigationGroups];
  } else if (canManageHCP) {
    // User with HCP management permission but no HCP registered: show HCP setup
    // Route to /hcp - component will auto-show register form if no HCPs exist
    groups = [
      {
        id: 'hcp-setup',
        label: 'HCP Setup',
        icon: 'Building2',
        requiredRoles: ['owner', 'clinic_admin', 'admin'],
        requiredPermissions: [],
        items: [
          {
            id: 'hcp-setup-item',
            label: 'HCP Setup',
            icon: 'Building2',
            path: '/hcp',
            requiredRoles: ['owner', 'clinic_admin', 'admin'],
            requiredPermissions: []
          }
        ]
      },
      ...baseNavigationGroups
    ];
  } else if (isStaff) {
    // Staff (doctor/receptionist/billing) without HCP: show all base groups
    groups = [...baseNavigationGroups];
  } else {
    // Patient/user without HCP: show only dashboards
    groups = [
      {
        id: 'dashboards',
        label: 'Dashboards',
        icon: 'LayoutDashboard',
        requiredRoles: ['owner', 'clinic_admin', 'admin', 'doctor', 'reception', 'receptionist', 'patient', 'user', 'billing'],
        requiredPermissions: [],
        items: [
          {
            id: 'patient-dashboard',
            label: 'My Appointments',
            icon: 'User',
            path: '/dashboard/patient',
            requiredRoles: ['owner', 'clinic_admin', 'admin', 'patient', 'user', 'guest', 'doctor', 'reception', 'receptionist'],
            requiredPermissions: []
          }
        ]
      }
    ];
  }
  
  return groups.filter(group => 
    hasAccess(userRoles, userPermissions, group.requiredRoles, group.requiredPermissions)
  ).map(group => ({
    ...group,
    items: group.items.filter(item => 
      hasAccess(userRoles, userPermissions, item.requiredRoles, item.requiredPermissions)
    )
  }));
}

// Legacy export for backward compatibility
export const navigationGroups = baseNavigationGroups;