// Export all PostgreSQL models
// NOTE: User and UserPrivilege models removed - now using SharedUser and PlatformPrivilege from platforms_99 database
// Only export models that actually exist
// export { HealthcareProvider } from './HealthcareProvider'; // Not yet implemented
// export { Clinic } from './Clinic'; // Not yet implemented
// export { Practice } from './Practice'; // Not yet implemented
// export { DoctorProfile } from './DoctorProfile'; // Not yet implemented
// export { DoctorAssignment } from './DoctorAssignment'; // Not yet implemented
// export { DoctorSchedule } from './DoctorSchedule'; // Not yet implemented
// export { ReceptionistProfile } from './ReceptionistProfile'; // Not yet implemented
// export { ReceptionistAssignment } from './ReceptionistAssignment'; // Not yet implemented
// export { Patient } from './Patient'; // Not yet implemented
// export { Appointment } from './Appointment'; // Not yet implemented
// export { AppointmentWorkflowLog } from './AppointmentWorkflowLog'; // Not yet implemented
// export { AppointmentStatus, WORKFLOW_STAGES, TOTAL_WORKFLOW_STAGES } from './types'; // Not yet implemented
export { PastVisit } from './PastVisit';
export { UnverifiedDoctor } from './UnverifiedDoctor';
export { PastPrescription } from './PastPrescription';
export { Receipt, ReceiptType } from './Receipt';
export { PastTestResult } from './PastTestResult';
export { Pharmacy } from './Pharmacy';
export { DiagnosticsCenter } from './DiagnosticsCenter';
export { MedicinePurchase } from './MedicinePurchase';
export { VitalParameter } from './VitalParameter';
export { VitalParameterDefinition } from './VitalParameterDefinition';

// Model array for Sequelize initialization
// Only import models that actually exist
// import { HealthcareProvider } from './HealthcareProvider'; // Not yet implemented
// import { Clinic } from './Clinic'; // Not yet implemented
// import { Practice } from './Practice'; // Not yet implemented
// import { DoctorProfile } from './DoctorProfile'; // Not yet implemented
// import { DoctorAssignment } from './DoctorAssignment'; // Not yet implemented
// import { DoctorSchedule } from './DoctorSchedule'; // Not yet implemented
// import { ReceptionistProfile } from './ReceptionistProfile'; // Not yet implemented
// import { ReceptionistAssignment } from './ReceptionistAssignment'; // Not yet implemented
// import { Patient } from './Patient'; // Not yet implemented
// import { Appointment } from './Appointment'; // Not yet implemented
// import { AppointmentWorkflowLog } from './AppointmentWorkflowLog'; // Not yet implemented
import { PastVisit } from './PastVisit';
import { UnverifiedDoctor } from './UnverifiedDoctor';
import { PastPrescription } from './PastPrescription';
import { Receipt } from './Receipt';
import { PastTestResult } from './PastTestResult';
import { Pharmacy } from './Pharmacy';
import { DiagnosticsCenter } from './DiagnosticsCenter';
import { MedicinePurchase } from './MedicinePurchase';
import { VitalParameter } from './VitalParameter';
import { VitalParameterDefinition } from './VitalParameterDefinition';

export const models = [
  // HealthcareProvider, // Not yet implemented
  // Clinic, // Not yet implemented
  // Practice, // Not yet implemented
  // DoctorProfile, // Not yet implemented
  // DoctorAssignment, // Not yet implemented
  // DoctorSchedule, // Not yet implemented
  // ReceptionistProfile, // Not yet implemented
  // ReceptionistAssignment, // Not yet implemented
  // Patient, // Not yet implemented
  // Appointment, // Not yet implemented
  // AppointmentWorkflowLog, // Not yet implemented
  PastVisit,
  UnverifiedDoctor,
  PastPrescription,
  Receipt,
  PastTestResult,
  Pharmacy,
  DiagnosticsCenter,
  MedicinePurchase
  // VitalParameter, // Has decorator issues - exclude for now
  // VitalParameterDefinition // Has decorator issues - exclude for now
];

