import React, { useState } from 'react';
import { Device, Group } from '@shared/types';
import './GroupManager.css';

interface GroupManagerProps {
  devices: Device[];
  groups: Group[];
  currentDeviceId: string;
  onCreateGroup: (name: string, deviceIds: string[], color?: string) => void;
  onUpdateGroup: (groupId: string, updates: Partial<Group>) => void;
  onDeleteGroup: (groupId: string) => void;
}

const GroupManager: React.FC<GroupManagerProps> = ({
  devices,
  groups,
  currentDeviceId,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState('');
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());

  const handleCreateGroup = () => {
    if (!groupName.trim() || selectedDevices.size === 0) {
      alert('Please enter a group name and select at least one device');
      return;
    }

    onCreateGroup(groupName.trim(), Array.from(selectedDevices));
    setGroupName('');
    setSelectedDevices(new Set());
    setShowCreateModal(false);
  };

  const handleUpdateGroup = () => {
    if (!editingGroup) return;

    if (!groupName.trim() || selectedDevices.size === 0) {
      alert('Please enter a group name and select at least one device');
      return;
    }

    onUpdateGroup(editingGroup.id, {
      name: groupName.trim(),
      deviceIds: Array.from(selectedDevices)
    });
    
    setGroupName('');
    setSelectedDevices(new Set());
    setEditingGroup(null);
  };

  const openCreateModal = () => {
    setGroupName('');
    setSelectedDevices(new Set());
    setEditingGroup(null);
    setShowCreateModal(true);
  };

  const openEditModal = (group: Group) => {
    setGroupName(group.name);
    setSelectedDevices(new Set(group.deviceIds));
    setEditingGroup(group);
    setShowCreateModal(true);
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingGroup(null);
    setGroupName('');
    setSelectedDevices(new Set());
  };

  const toggleDevice = (deviceId: string) => {
    const newSelected = new Set(selectedDevices);
    if (newSelected.has(deviceId)) {
      newSelected.delete(deviceId);
    } else {
      newSelected.add(deviceId);
    }
    setSelectedDevices(newSelected);
  };

  const getDeviceName = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    return device?.name || 'Unknown Device';
  };

  return (
    <div className="group-manager">
      <div className="group-manager-header">
        <h3>Device Groups</h3>
        <button className="create-group-btn" onClick={openCreateModal}>
          + Create Group
        </button>
      </div>

      <div className="groups-list">
        {groups.length === 0 ? (
          <p className="no-groups">No groups yet. Create one to broadcast to multiple devices!</p>
        ) : (
          groups.map(group => (
            <div key={group.id} className="group-item" style={{ borderLeftColor: group.color }}>
              <div className="group-info">
                <div className="group-name">{group.name}</div>
                <div className="group-devices">
                  {group.deviceIds.map(deviceId => (
                    <span key={deviceId} className="device-badge">
                      {getDeviceName(deviceId)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="group-actions">
                <button 
                  className="edit-btn" 
                  onClick={() => openEditModal(group)}
                  title="Edit group"
                >
                  ✏️
                </button>
                <button 
                  className="delete-btn" 
                  onClick={() => {
                    if (confirm(`Delete group "${group.name}"?`)) {
                      onDeleteGroup(group.id);
                    }
                  }}
                  title="Delete group"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingGroup ? 'Edit Group' : 'Create New Group'}</h3>
              <button className="close-btn" onClick={closeModal}>×</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g., My Devices, Work Phones"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Select Devices ({selectedDevices.size} selected)</label>
                <div className="device-selection">
                  {devices
                    .filter(d => d.id !== currentDeviceId && d.online)
                    .map(device => (
                      <div
                        key={device.id}
                        className={`device-option ${selectedDevices.has(device.id) ? 'selected' : ''}`}
                        onClick={() => toggleDevice(device.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedDevices.has(device.id)}
                          onChange={() => {}}
                        />
                        <span className="device-icon">
                          {device.type === 'phone' ? '📱' : '💻'}
                        </span>
                        <span className="device-name">{device.name}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={closeModal}>
                Cancel
              </button>
              <button 
                className="save-btn" 
                onClick={editingGroup ? handleUpdateGroup : handleCreateGroup}
              >
                {editingGroup ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupManager;
