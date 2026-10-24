
import Organization from "../models/Organization.js";

export const createOrganization = async (req, res) => {
  try {
    const body = req.body ?? {};
    const name = body.name ?? body.organizationName;
    const email = body.email;
    const address = body.address;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Organization name is required.",
        receivedBody: body,
      });
    }

    const existingOrganization = await Organization.findOne();

    if (existingOrganization) {
      return res.status(409).json({
        success: false,
        message: "Organization is already set up.",
        organization: existingOrganization,
      });
    }

    const organization = await Organization.create({
      name: name.trim(),
      email,
      address,
    });

    return res.status(201).json({
      success: true,
      message: "Organization created successfully.",
      organization,
    });
  } catch (error) {
    console.error("Organization setup error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create organization.",
    });
  }
};

export const getOrganization = async (req, res) => {
  try {
    const organization = await Organization.findOne();

    return res.status(200).json({
      success: true,
      organization,
    });
  } catch (error) {
    console.error("Get organization error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch organization.",
    });
  }
};
