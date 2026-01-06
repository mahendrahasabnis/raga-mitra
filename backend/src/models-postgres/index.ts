// Export all PostgreSQL models
// NOTE: User and UserPrivilege models removed - now using SharedUser and PlatformPrivilege from platforms_99 database
export { HealthcareProvider } from './HealthcareProvider';
export { Clinic } from './Clinic';
export { Practice } from './Practice';
export { DoctorProfile } from './DoctorProfile';
export { DoctorAssignment } from './DoctorAssignment';
export { DoctorSchedule } from './DoctorSchedule';
export { ReceptionistProfile } from './ReceptionistProfile';
export { ReceptionistAssignment } from './ReceptionistAssignment';
export { Patient } from './Patient';
export { Appointment } from './Appointment';
export { AppointmentWorkflowLog } from './AppointmentWorkflowLog';
export { AppointmentStatus, WORKFLOW_STAGES, TOTAL_WORKFLOW_STAGES } from './types';
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
import { HealthcareProvider } from './HealthcareProvider';
import { Clinic } from './Clinic';
import { Practice } from './Practice';
import { DoctorProfile } from './DoctorProfile';
import { DoctorAssignment } from './DoctorAssignment';
import { DoctorSchedule } from './DoctorSchedule';
import { ReceptionistProfile } from './ReceptionistProfile';
import { ReceptionistAssignment } from './ReceptionistAssignment';
import { Patient } from './Patient';
import { Appointment } from './Appointment';
import { AppointmentWorkflowLog } from './AppointmentWorkflowLog';
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
  HealthcareProvider,
  Clinic,
  Practice,
  DoctorProfile,
  DoctorAssignment,
  DoctorSchedule,
  ReceptionistProfile,
  ReceptionistAssignment,
  Patient,
  Appointment,
  AppointmentWorkflowLog,
  PastVisit,
  UnverifiedDoctor,
  PastPrescription,
  Receipt,
  PastTestResult,
  Pharmacy,
  DiagnosticsCenter,
  MedicinePurchase,
  VitalParameter,
  VitalParameterDefinition
];

