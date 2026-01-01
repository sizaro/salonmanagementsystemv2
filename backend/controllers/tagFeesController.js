import { 
  saveTagFee, 
  fetchAllTagFees, 
  fetchTagFeeById, 
  UpdateTagFeeById, 
  DeleteTagFeeById 
} from "../models/tagFeesModel.js";

/**
 * Get all tag fees for the salon
 */
export const getAllTagFees = async (req, res) => {
  try {
    const salon_id = req.user.salon_id;
    const tagFees = await fetchAllTagFees(salon_id);
    res.status(200).json(tagFees);
  } catch (err) {
    console.error('Error fetching tag fees:', err);
    res.status(500).json({ error: 'Failed to fetch tag fees' });
  }
};

/**
 * Get tag fee by ID (only for the salon)
 */
export const getTagFeeById = async (req, res) => {
  try {
    const { id } = req.params;
    const salon_id = req.user.salon_id;

    const tagFee = await fetchTagFeeById(id, salon_id);
    if (!tagFee) return res.status(404).json({ error: "Tag fee not found" });

    res.status(200).json(tagFee);
  } catch (err) {
    console.error("Error fetching tag fee by ID:", err);
    res.status(500).json({ error: "Failed to fetch tag fee" });
  }
};

/**
 * Create new tag fee
 */
export const createTagFee = async (req, res) => {
  try {
    const { employee_id, amount, reason } = req.body;
    const salon_id = req.user.salon_id;

    console.log("Received new tag fee data:", req.body, "salon_id:", salon_id);

    const newTagFee = await saveTagFee({ employee_id, amount, reason, salon_id });

    res.status(201).json({ message: "Tag fee created successfully", data: newTagFee });
  } catch (err) {
    console.error("Error creating tag fee:", err);
    res.status(500).json({ error: "Failed to create tag fee" });
  }
};

/**
 * Update tag fee by ID
 */
export const updateTagFeeById = async (req, res) => {
  try {
    const { id, employee_id, reason, created_at } = req.body;
    const salon_id = req.user.salon_id;

    if (!id) return res.status(400).json({ error: "Missing tag fee ID" });

    const updatedTagFee = await UpdateTagFeeById({ id, employee_id, reason, created_at, salon_id });

    if (!updatedTagFee) return res.status(404).json({ error: "Tag fee not found or not updated" });

    res.status(200).json({ message: "Tag fee updated successfully", data: updatedTagFee });
  } catch (err) {
    console.error("Error updating tag fee:", err);
    res.status(500).json({ error: "Failed to update tag fee" });
  }
};

/**
 * Delete tag fee by ID
 */
export const deleteTagFeeById = async (req, res) => {
  try {
    const { id } = req.params;
    const salon_id = req.user.salon_id;

    const deleted = await DeleteTagFeeById(id, salon_id);
    if (!deleted) return res.status(404).json({ error: "Tag fee not found" });

    res.status(200).json({ message: "Tag fee deleted successfully" });
  } catch (err) {
    console.error("Error deleting tag fee:", err);
    res.status(500).json({ error: "Failed to delete tag fee" });
  }
};

export default {
  getAllTagFees,
  getTagFeeById,
  createTagFee,
  updateTagFeeById,
  deleteTagFeeById
};



// import { 
//   saveTagFee, 
//   fetchAllTagFees, 
//   fetchTagFeeById, 
//   UpdateTagFeeById, 
//   DeleteTagFeeById 
// } from "../models/tagFeesModel.js";

// /**
//  * Get all tag fees
//  */
// export const getAllTagFees = async (req, res) => {
//   try {
//     const tagFees = await fetchAllTagFees();
//     res.status(200).json(tagFees);
//   } catch (err) {
//     console.error('Error fetching tag fees:', err);
//     res.status(500).json({ error: 'Failed to fetch tag fees' });
//   }
// };

// /**
//  * Get tag fee by ID
//  */
// export const getTagFeeById = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const tagFee = await fetchTagFeeById(id);
//     if (!tagFee) {
//       return res.status(404).json({ error: "Tag fee not found" });
//     }
//     res.status(200).json(tagFee);
//   } catch (err) {
//     console.error("Error fetching tag fee by ID:", err);
//     res.status(500).json({ error: "Failed to fetch tag fee" });
//   }
// };

// /**
//  * Create new tag fee
//  */
// export const createTagFee = async (req, res) => {
//   try {
//     const { employee_id, amount, reason } = req.body; // fee is inside model logic

//     console.log("Received new tag fee data:", req.body);

//     const newTagFee = await saveTagFee({ employee_id, amount, reason });

//     res.status(201).json({ message: "Tag fee created successfully", data: newTagFee });
//   } catch (err) {
//     console.error("Error creating tag fee:", err);
//     res.status(500).json({ error: "Failed to create tag fee" });
//   }
// };

// /**
//  * Update tag fee by ID
//  */
// export const updateTagFeeById = async (req, res) => {
//   try {
//     const { id, employee_id, reason, created_at } = req.body;
//     if (!id) return res.status(400).json({ error: "Missing tag fee ID" });

//     const updatedTagFee = await UpdateTagFeeById({ id, employee_id, reason, created_at });

//     if (!updatedTagFee) {
//       return res.status(404).json({ error: "Tag fee not found or not updated" });
//     }

//     res.status(200).json({ message: "Tag fee updated successfully", data: updatedTagFee });
//   } catch (err) {
//     console.error("Error updating tag fee:", err);
//     res.status(500).json({ error: "Failed to update tag fee" });
//   }
// };

// /**
//  * Delete tag fee by ID
//  */
// export const deleteTagFeeById = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const deleted = await DeleteTagFeeById(id);
//     if (!deleted) return res.status(404).json({ error: "Tag fee not found" });
//     res.status(200).json({ message: "Tag fee deleted successfully" });
//   } catch (err) {
//     console.error("Error deleting tag fee:", err);
//     res.status(500).json({ error: "Failed to delete tag fee" });
//   }
// };

// export default {
//   getAllTagFees,
//   getTagFeeById,
//   createTagFee,
//   updateTagFeeById,
//   deleteTagFeeById
// };
