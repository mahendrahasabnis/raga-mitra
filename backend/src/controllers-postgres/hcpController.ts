// Lightweight in-memory HCP hierarchy to unblock frontend
// This avoids DB dependencies; replace with real models when available.

import { Request, Response } from "express";
import { v4 as uuid } from "uuid";

type Clinic = { id: string; name: string; address?: string };
type Practice = { id: string; name: string; clinicId?: string };
type Doctor = { id: string; name: string; clinicId?: string; practiceId?: string };
type Receptionist = { id: string; name: string; clinicId?: string; practiceId?: string };

interface HCP {
  id: string;
  name: string;
  type: string;
  registrationNumber?: string;
  clinics: Clinic[];
  practices: Practice[];
  doctors: Doctor[];
  receptionists: Receptionist[];
  createdAt: string;
}

const hcps: HCP[] = [];

export const getAll = (req: Request, res: Response) => {
  return res.json(hcps);
};

export const create = (req: Request, res: Response) => {
  const { name, type = "clinic", registrationNumber } = req.body || {};
  if (!name) return res.status(400).json({ message: "name required" });
  const hcp: HCP = {
    id: uuid(),
    name,
    type,
    registrationNumber,
    clinics: [],
    practices: [],
    doctors: [],
    receptionists: [],
    createdAt: new Date().toISOString(),
  };
  hcps.push(hcp);
  return res.status(201).json(hcp);
};

export const getById = (req: Request, res: Response) => {
  const hcp = hcps.find((h) => h.id === req.params.id);
  if (!hcp) return res.status(404).json({ message: "HCP not found" });
  return res.json(hcp);
};

export const update = (req: Request, res: Response) => {
  const hcp = hcps.find((h) => h.id === req.params.id);
  if (!hcp) return res.status(404).json({ message: "HCP not found" });
  const { name, type, registrationNumber } = req.body || {};
  if (name) hcp.name = name;
  if (type) hcp.type = type;
  if (registrationNumber) hcp.registrationNumber = registrationNumber;
  return res.json(hcp);
};

export const addClinic = (req: Request, res: Response) => {
  const hcp = hcps.find((h) => h.id === req.params.id);
  if (!hcp) return res.status(404).json({ message: "HCP not found" });
  const { name, address } = req.body || {};
  if (!name) return res.status(400).json({ message: "clinic name required" });
  const clinic: Clinic = { id: uuid(), name, address };
  hcp.clinics.push(clinic);
  return res.status(201).json(clinic);
};

export const updateClinic = (req: Request, res: Response) => {
  const hcp = hcps.find((h) => h.id === req.params.id);
  if (!hcp) return res.status(404).json({ message: "HCP not found" });
  const clinic = hcp.clinics.find((c) => c.id === req.params.clinicId);
  if (!clinic) return res.status(404).json({ message: "Clinic not found" });
  const { name, address } = req.body || {};
  if (name) clinic.name = name;
  if (address) clinic.address = address;
  return res.json(clinic);
};

export const deleteClinic = (req: Request, res: Response) => {
  const hcp = hcps.find((h) => h.id === req.params.id);
  if (!hcp) return res.status(404).json({ message: "HCP not found" });
  hcp.clinics = hcp.clinics.filter((c) => c.id !== req.params.clinicId);
  return res.json({ success: true });
};

export const addPractice = (req: Request, res: Response) => {
  const hcp = hcps.find((h) => h.id === req.params.id);
  if (!hcp) return res.status(404).json({ message: "HCP not found" });
  const { name, clinicId } = req.body || {};
  if (!name) return res.status(400).json({ message: "practice name required" });
  const practice: Practice = { id: uuid(), name, clinicId };
  hcp.practices.push(practice);
  return res.status(201).json(practice);
};

export const updatePractice = (req: Request, res: Response) => {
  const hcp = hcps.find((h) => h.id === req.params.id);
  if (!hcp) return res.status(404).json({ message: "HCP not found" });
  const practice = hcp.practices.find((p) => p.id === req.params.practiceId);
  if (!practice) return res.status(404).json({ message: "Practice not found" });
  const { name, clinicId } = req.body || {};
  if (name) practice.name = name;
  if (clinicId) practice.clinicId = clinicId;
  return res.json(practice);
};

export const deletePractice = (req: Request, res: Response) => {
  const hcp = hcps.find((h) => h.id === req.params.id);
  if (!hcp) return res.status(404).json({ message: "HCP not found" });
  hcp.practices = hcp.practices.filter((p) => p.id !== req.params.practiceId);
  return res.json({ success: true });
};

export const addDoctor = (req: Request, res: Response) => {
  const hcp = hcps.find((h) => h.id === req.params.id);
  if (!hcp) return res.status(404).json({ message: "HCP not found" });
  const { name, clinicId, practiceId } = req.body || {};
  if (!name) return res.status(400).json({ message: "doctor name required" });
  const doctor: Doctor = { id: uuid(), name, clinicId, practiceId };
  hcp.doctors.push(doctor);
  return res.status(201).json(doctor);
};

export const updateDoctor = (req: Request, res: Response) => {
  const hcp = hcps.find((h) => h.id === req.params.id);
  if (!hcp) return res.status(404).json({ message: "HCP not found" });
  const doctor = hcp.doctors.find((d) => d.id === req.params.doctorId);
  if (!doctor) return res.status(404).json({ message: "Doctor not found" });
  const { name, clinicId, practiceId } = req.body || {};
  if (name) doctor.name = name;
  if (clinicId !== undefined) doctor.clinicId = clinicId;
  if (practiceId !== undefined) doctor.practiceId = practiceId;
  return res.json(doctor);
};

export const deleteDoctor = (req: Request, res: Response) => {
  const hcp = hcps.find((h) => h.id === req.params.id);
  if (!hcp) return res.status(404).json({ message: "HCP not found" });
  hcp.doctors = hcp.doctors.filter((d) => d.id !== req.params.doctorId);
  return res.json({ success: true });
};

export const assignReceptionist = (req: Request, res: Response) => {
  const hcp = hcps.find((h) => h.id === req.params.id);
  if (!hcp) return res.status(404).json({ message: "HCP not found" });
  const { name, clinicId, practiceId } = req.body || {};
  if (!name) return res.status(400).json({ message: "receptionist name required" });
  const receptionist: Receptionist = { id: uuid(), name, clinicId, practiceId };
  hcp.receptionists.push(receptionist);
  return res.status(201).json(receptionist);
};

export const deleteReceptionist = (req: Request, res: Response) => {
  const hcp = hcps.find((h) => h.id === req.params.id);
  if (!hcp) return res.status(404).json({ message: "HCP not found" });
  hcp.receptionists = hcp.receptionists.filter((r) => r.id !== req.params.receptionistId);
  return res.json({ success: true });
};
