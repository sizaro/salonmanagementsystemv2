import dotenv from "dotenv";
dotenv.config();

import {
  fetchSectionsModel,
  fetchSectionByIdModel,
  createSectionModel,
  updateSectionModel,
  deleteSectionModel,
} from "../models/sectionsModel.js";


const resolveSalonId = (req) => {
  return (
    req.user?.salon_id ||
    req.salon_id ||
    Number(process.env.DEFAULT_SALON_ID)
  );
};

// GET ALL SECTIONS FOR SALON
export const getSections = async (req, res) => {
  try {
    const salon_id = resolveSalonId(req);
    if (!salon_id) {
      return res.status(400).json({ error: "Salon context missing" });
    }

    const sections = await fetchSectionsModel(salon_id);
    res.status(200).json(sections);
  } catch (err) {
    console.error("Error fetching sections:", err);
    res.status(500).json({ error: "Failed to fetch sections" });
  }
};

// GET SINGLE SECTION BY ID
export const getSection = async (req, res) => {
  try {
    const { id } = req.params;
    const salon_id = resolveSalonId(req);
    if (!salon_id) {
      return res.status(400).json({ error: "Salon context missing" });
    }

    const section = await fetchSectionByIdModel(id, salon_id);
    if (!section) {
      return res.status(404).json({ error: "Section not found" });
    }

    res.status(200).json(section);
  } catch (err) {
    console.error("Error fetching section:", err);
    res.status(500).json({ error: "Failed to fetch section" });
  }
};

// CREATE NEW SECTION
export const createSection = async (req, res) => {
  try {
    const { section_name } = req.body;
    const salon_id = resolveSalonId(req);
    if (!salon_id) {
      return res.status(400).json({ error: "Salon context missing" });
    }

    const newSection = await createSectionModel({
      section_name,
      salon_id
    });

    res.status(201).json({
      message: "Section created successfully",
      data: newSection
    });
  } catch (err) {
    console.error("Error creating section:", err);
    res.status(500).json({ error: "Failed to create section" });
  }
};

// UPDATE SECTION
export const updateSection = async (req, res) => {
  try {
    const { id, section_name } = req.body;
    const salon_id = resolveSalonId(req);
    if (!salon_id) {
      return res.status(400).json({ error: "Salon context missing" });
    }

    const updatedSection = await updateSectionModel({
      id,
      section_name,
      salon_id
    });

    if (!updatedSection) {
      return res.status(404).json({ error: "Section not found or not updated" });
    }

    res.status(200).json({
      message: "Section updated successfully",
      data: updatedSection
    });
  } catch (err) {
    console.error("Error updating section:", err);
    res.status(500).json({ error: "Failed to update section" });
  }
};

// DELETE SECTION
export const deleteSection = async (req, res) => {
  try {
    const { id } = req.params;
    const salon_id = resolveSalonId(req);
    if (!salon_id) {
      return res.status(400).json({ error: "Salon context missing" });
    }

    const deleted = await deleteSectionModel(id, salon_id);
    if (!deleted) {
      return res.status(404).json({ error: "Section not found" });
    }

    res.status(200).json({ message: "Section deleted successfully" });
  } catch (err) {
    console.error("Error deleting section:", err);
    res.status(500).json({ error: "Failed to delete section" });
  }
};

export default {
  getSections,
  getSection,
  createSection,
  updateSection,
  deleteSection
};

