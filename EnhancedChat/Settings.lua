local Settings = {}

local SETTINGS_PATH = FileMgr.GetMenuRootPath() .. "\\Lua\\EnhancedChat\\data\\settings.json"

Settings.settings = {
    notifyNewMessages = true,
    notifyUserJoin = true,
    notifyUserDisconnect = true,
    notifyBroadcast = true,
    toastDuration = 3000,
    enableSound = true
}

function Settings.LoadSettings()
    pcall(function()
        if FileMgr.DoesFileExist(SETTINGS_PATH) then
            local content = FileMgr.ReadFileContent(SETTINGS_PATH)
            if content and content ~= "" then
                if json and json.decode then
                    local loaded = json.decode(content)
                    if loaded then
                        for key, value in pairs(loaded) do
                            Settings.settings[key] = value
                        end
                        print("Enhanced Chat: Settings loaded (JSON)")
                    end
                else
                    local val = content:match('"notifyNewMessages"%s*:%s*(true|false)')
                    if val then Settings.settings.notifyNewMessages = (val == "true") end
                    val = content:match('"notifyUserJoin"%s*:%s*(true|false)')
                    if val then Settings.settings.notifyUserJoin = (val == "true") end
                    val = content:match('"notifyUserDisconnect"%s*:%s*(true|false)')
                    if val then Settings.settings.notifyUserDisconnect = (val == "true") end
                    val = content:match('"notifyBroadcast"%s*:%s*(true|false)')
                    if val then Settings.settings.notifyBroadcast = (val == "true") end
                    val = content:match('"toastDuration"%s*:%s*(%d+)')
                    if val then Settings.settings.toastDuration = tonumber(val) end
                    val = content:match('"enableSound"%s*:%s*(true|false)')
                    if val then Settings.settings.enableSound = (val == "true") end
                    print("Enhanced Chat: Settings loaded (Fallback)")
                end
            end
        else
            Settings.SaveSettings()
            print("Enhanced Chat: Created new settings.json")
        end
    end)
    return Settings.settings
end

function Settings.SaveSettings()
    pcall(function()
        local dataPath = FileMgr.GetMenuRootPath() .. "\\Lua\\EnhancedChat\\data"
        FileMgr.CreateDir(dataPath)
        
        local jsonStr = "{\n"
        jsonStr = jsonStr .. '  "notifyNewMessages": ' .. (Settings.settings.notifyNewMessages and "true" or "false") .. ",\n"
        jsonStr = jsonStr .. '  "notifyUserJoin": ' .. (Settings.settings.notifyUserJoin and "true" or "false") .. ",\n"
        jsonStr = jsonStr .. '  "notifyUserDisconnect": ' .. (Settings.settings.notifyUserDisconnect and "true" or "false") .. ",\n"
        jsonStr = jsonStr .. '  "notifyBroadcast": ' .. (Settings.settings.notifyBroadcast and "true" or "false") .. ",\n"
        jsonStr = jsonStr .. '  "toastDuration": ' .. tostring(Settings.settings.toastDuration) .. ",\n"
        jsonStr = jsonStr .. '  "enableSound": ' .. (Settings.settings.enableSound and "true" or "false") .. "\n"
        jsonStr = jsonStr .. "}"
        
        FileMgr.WriteFileContent(SETTINGS_PATH, jsonStr, false)
        print("Enhanced Chat: Settings saved to " .. SETTINGS_PATH)
    end)
end

function Settings.Render()
    local open, shouldShow = ImGui.Begin("Enhanced Chat - Settings", true, 32)
    
    if not shouldShow then
        GUI.showSettings = false
    end
    
    if open then
        ImGui.TextColored(100, 200, 100, 255, "Notifications")
        ImGui.Separator()
        
        local newMsgs, changedNewMsgs = ImGui.Checkbox(
            "Notify on new messages",
            Settings.settings.notifyNewMessages
        )
        if changedNewMsgs then
            Settings.settings.notifyNewMessages = newMsgs
            Settings.SaveSettings()
            print("Enhanced Chat: New message notifications " .. (newMsgs and "enabled" or "disabled"))
        end
        
        local userJoin, changedUserJoin = ImGui.Checkbox(
            "Notify on user join",
            Settings.settings.notifyUserJoin
        )
        if changedUserJoin then
            Settings.settings.notifyUserJoin = userJoin
            Settings.SaveSettings()
            print("Enhanced Chat: User join notifications " .. (userJoin and "enabled" or "disabled"))
        end
        
        local userDisc, changedUserDisc = ImGui.Checkbox(
            "Notify on user disconnect",
            Settings.settings.notifyUserDisconnect
        )
        if changedUserDisc then
            Settings.settings.notifyUserDisconnect = userDisc
            Settings.SaveSettings()
            print("Enhanced Chat: User disconnect notifications " .. (userDisc and "enabled" or "disabled"))
        end
        
        local broadcast, changedBroadcast = ImGui.Checkbox(
            "Notify on broadcast messages",
            Settings.settings.notifyBroadcast
        )
        if changedBroadcast then
            Settings.settings.notifyBroadcast = broadcast
            Settings.SaveSettings()
            print("Enhanced Chat: Broadcast notifications " .. (broadcast and "enabled" or "disabled"))
        end
        
        local sound, changedSound = ImGui.Checkbox(
            "Enable notification sounds",
            Settings.settings.enableSound
        )
        if changedSound then
            Settings.settings.enableSound = sound
            Settings.SaveSettings()
            print("Enhanced Chat: Sound " .. (sound and "enabled" or "disabled"))
        end
        
        ImGui.Spacing()
        ImGui.Separator()
        ImGui.TextColored(150, 150, 150, 255, "Toast Duration (ms): " .. tostring(Settings.settings.toastDuration))
        
        local newDuration, durationChanged = ImGui.SliderInt("##ToastDuration", Settings.settings.toastDuration, 1000, 10000)
        if durationChanged then
            Settings.settings.toastDuration = newDuration
            Settings.SaveSettings()
        end
        
        ImGui.End()
    end
end

return Settings
