

import {
  fetchSectionsModel,
  fetchSectionByIdModel,
  createSectionModel,
  updateSectionModel,
  deleteSectionModel,
} from "../models/sectionsModel.js";

// GET ALL SECTIONS FOR SALON
export const getSections = async (req, res) => {
  try {
    const salon_id = req.user.salon_id;
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
    const salon_id = req.user.salon_id;
    const section = await fetchSectionByIdModel(id, salon_id);
    if (!section) return res.status(404).json({ error: "Section not found" });
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
    const salon_id = req.user.salon_id;

    const newSection = await createSectionModel({ section_name, salon_id });
    res.status(201).json({ message: "Section created successfully", data: newSection });
  } catch (err) {
    console.error("Error creating section:", err);
    res.status(500).json({ error: "Failed to create section" });
  }
};

// UPDATE SECTION
export const updateSection = async (req, res) => {
  try {
    const { id, section_name } = req.body;
    const salon_id = req.user.salon_id;

    const updatedSection = await updateSectionModel({ id, section_name, salon_id });
    if (!updatedSection) return res.status(404).json({ error: "Section not found or not updated" });

    res.status(200).json({ message: "Section updated successfully", data: updatedSection });
  } catch (err) {
    console.error("Error updating section:", err);
    res.status(500).json({ error: "Failed to update section" });
  }
};

// DELETE SECTION
export const deleteSection = async (req, res) => {
  try {
    const { id } = req.params;
    const salon_id = req.user.salon_id;

    const deleted = await deleteSectionModel(id, salon_id);
    if (!deleted) return res.status(404).json({ error: "Section not found" });

    res.status(200).json({ message: "Section deleted successfully" });
  } catch (err) {
    console.error("Error deleting section:", err);
    res.status(500).json({ error: "Failed to delete section" });
  }
};



// import {
//   fetchSectionsModel,
//   fetchSectionByIdModel,
//   createSectionModel,
//   updateSectionModel,
//   deleteSectionModel,
// } from "../models/sectionsModel.js";

// // Get all sections
// export const getSections = async (req, res) => {
//   try {
//     const sections = await fetchSectionsModel();
//     res.status(200).json(sections);
//   } catch (err) {
//     console.error("Error fetching sections:", err);
//     res.status(500).json({ error: "Failed to fetch sections" });
//   }
// };

// // Get one section by ID
// export const getSection = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const section = await fetchSectionByIdModel(id);
//     if (!section) return res.status(404).json({ error: "Section not found" });
//     res.status(200).json(section);
//   } catch (err) {
//     console.error("Error fetching section:", err);
//     res.status(500).json({ error: "Failed to fetch section" });
//   }
// };

// // Create a section
// export const createSection = async (req, res) => {
//   try {
//     const newSection = await createSectionModel(req.body);
//     res.status(201).json(newSection);
//   } catch (err) {
//     console.error("Error creating section:", err);
//     res.status(500).json({ error: "Failed to create section" });
//   }
// };

// // Update a section
// export const updateSection = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const updatedSection = await updateSectionModel(req.body);
//     if (!updatedSection) return res.status(404).json({ error: "Section not found" });
//     res.status(200).json(updatedSection);
//   } catch (err) {
//     console.error("Error updating section:", err);
//     res.status(500).json({ error: "Failed to update section" });
//   }
// };

// // Delete a section
// export const deleteSection = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const deleted = await deleteSectionModel(id);
//     if (!deleted) return res.status(404).json({ error: "Section not found" });
//     res.status(200).json({ message: "Section deleted successfully" });
//   } catch (err) {
//     console.error("Error deleting section:", err);
//     res.status(500).json({ error: "Failed to delete section" });
//   }
// };
