package com.flowlink.app.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.flowlink.app.R
import com.flowlink.app.model.Device

class DeviceTileAdapter(
    private val devices: List<Device>,
    private val onDeviceClick: (Device) -> Unit,
    private val onBrowseFilesClick: (Device) -> Unit
) : RecyclerView.Adapter<DeviceTileAdapter.DeviceViewHolder>() {

    class DeviceViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val deviceName: TextView = itemView.findViewById(R.id.device_name)
        val deviceType: TextView = itemView.findViewById(R.id.device_type)
        val deviceStatus: TextView = itemView.findViewById(R.id.device_status)
        val devicePermissions: TextView = itemView.findViewById(R.id.device_permissions)
        val btnBrowseFiles: Button = itemView.findViewById(R.id.btn_browse_files)
        val tvTapHint: TextView = itemView.findViewById(R.id.tv_tap_hint)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): DeviceViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_device_tile, parent, false)
        return DeviceViewHolder(view)
    }

    override fun onBindViewHolder(holder: DeviceViewHolder, position: Int) {
        val device = devices[position]
        holder.deviceName.text = device.name
        holder.deviceType.text = device.type
        
        holder.deviceStatus.text = if (device.online) "Online" else "Offline"
        holder.deviceStatus.setTextColor(
            if (device.online) {
                android.graphics.Color.parseColor("#4CAF50")
            } else {
                android.graphics.Color.parseColor("#999999")
            }
        )
        
        // Show permissions
        val permissionList = mutableListOf<String>()
        device.permissions.forEach { (key, value) ->
            if (value) {
                permissionList.add(key.replace("_", " ").replaceFirstChar { it.uppercaseChar() })
            }
        }
        holder.devicePermissions.text = if (permissionList.isEmpty()) {
            "No permissions"
        } else {
            permissionList.joinToString(", ")
        }

        // Enable/disable buttons based on device status
        val isOnline = device.online
        holder.btnBrowseFiles.isEnabled = isOnline
        holder.btnBrowseFiles.alpha = if (isOnline) 1.0f else 0.5f

        // Update hint text based on device status
        holder.tvTapHint.text = if (isOnline) {
            "Tap tile to send clipboard"
        } else {
            "Device offline"
        }
        holder.tvTapHint.setTextColor(
            if (isOnline) {
                android.graphics.Color.parseColor("#666666")
            } else {
                android.graphics.Color.parseColor("#999999")
            }
        )

        // When a device tile is tapped, send clipboard content (URL/text)
        holder.itemView.setOnClickListener {
            if (isOnline) {
                onDeviceClick(device)
            }
        }

        // When browse files button is clicked, open file picker
        holder.btnBrowseFiles.setOnClickListener {
            if (isOnline) {
                onBrowseFilesClick(device)
            }
        }
    }

    override fun getItemCount(): Int = devices.size
}
