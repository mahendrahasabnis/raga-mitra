import { Router } from "express";
import * as hcpController from "../controllers-postgres/hcpController";

const router = Router();

// HCP CRUD
router.get("/all", hcpController.getAll);
router.post("/", hcpController.create);
router.get("/:id", hcpController.getById);
router.put("/:id", hcpController.update);

// Clinics
router.post("/:id/clinics", hcpController.addClinic);
router.put("/:id/clinics/:clinicId", hcpController.updateClinic);
router.delete("/:id/clinic/:clinicId", hcpController.deleteClinic);

// Practices
router.post("/:id/practices", hcpController.addPractice);
router.put("/:id/practices/:practiceId", hcpController.updatePractice);
router.delete("/:id/practices/:practiceId", hcpController.deletePractice);

// Doctors
router.post("/:id/doctors", hcpController.addDoctor);
router.put("/:id/doctors/:doctorId", hcpController.updateDoctor);
router.delete("/:id/doctors/:doctorId", hcpController.deleteDoctor);

// Receptionists
router.post("/:id/assign-receptionist", hcpController.assignReceptionist);
router.delete("/:id/receptionists/:receptionistId", hcpController.deleteReceptionist);

export default router;
