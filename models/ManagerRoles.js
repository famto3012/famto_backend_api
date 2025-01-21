const mongoose = require("mongoose");

const managerRolesSchema = mongoose.Schema(
  {
    roleName: {
      type: String,
      required: true,
    },
    allowedRoutes: [
      {
        label: {
          type: String,
          required: true,
        },
        route: {
          type: String,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const ManagerRoles = mongoose.model("ManagerRoles", managerRolesSchema);
module.exports = ManagerRoles;
