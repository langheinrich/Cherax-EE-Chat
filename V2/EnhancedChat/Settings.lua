local Settings = {}

local SETTINGS_PATH = FileMgr.GetMenuRootPath() .. "\\Lua\\EnhancedChat\\data\\settings.json"

Settings.settings = {
    notifyNewMessages = true,
    notifyUserJoin = true,
    notifyUserDisconnect = true,
    autoScroll = true,
    showUserList = true,

    toastDuration = 3000,
    enableSound = true,
    toggleHotkey = 0x78
}

Settings.chatFeatureHash = nil

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
                    end
                else
                    -- Helper function to parse boolean from JSON
                    local function parseBool(content, key)
                        local trueMatch = content:match('"' .. key .. '"%s*:%s*true')
                        if trueMatch then return true end
                        local falseMatch = content:match('"' .. key .. '"%s*:%s*false')
                        if falseMatch then return false end
                        return nil
                    end
                    
                    local val = parseBool(content, "notifyNewMessages")
                    if val ~= nil then Settings.settings.notifyNewMessages = val end
                    val = parseBool(content, "notifyUserJoin")
                    if val ~= nil then Settings.settings.notifyUserJoin = val end
                    val = parseBool(content, "notifyUserDisconnect")
                    if val ~= nil then Settings.settings.notifyUserDisconnect = val end
                    val = parseBool(content, "autoScroll")
                    if val ~= nil then Settings.settings.autoScroll = val end
                    val = parseBool(content, "showUserList")
                    if val ~= nil then Settings.settings.showUserList = val end
                    val = parseBool(content, "enableSound")
                    if val ~= nil then Settings.settings.enableSound = val end

                    val = content:match('"toastDuration"%s*:%s*(%d+)')
                    if val then Settings.settings.toastDuration = tonumber(val) end
                    val = content:match('"toggleHotkey"%s*:%s*(%d+)')
                    if val then Settings.settings.toggleHotkey = tonumber(val) end
                end
            end
        else
            Settings.SaveSettings()
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
        jsonStr = jsonStr .. '  "autoScroll": ' .. (Settings.settings.autoScroll and "true" or "false") .. ",\n"
        jsonStr = jsonStr .. '  "showUserList": ' .. (Settings.settings.showUserList and "true" or "false") .. ",\n"

        jsonStr = jsonStr .. '  "toastDuration": ' .. tostring(Settings.settings.toastDuration) .. ",\n"
        jsonStr = jsonStr .. '  "enableSound": ' .. (Settings.settings.enableSound and "true" or "false") .. ",\n"
        jsonStr = jsonStr .. '  "toggleHotkey": ' .. tostring(Settings.settings.toggleHotkey) .. "\n"
        jsonStr = jsonStr .. "}"
        
        FileMgr.WriteFileContent(SETTINGS_PATH, jsonStr, false)
    end)
end

function Settings.Render()
    ImGui.SetNextWindowSize(300, 0, 2)
    local open, shouldShow = ImGui.Begin("Enhanced Chat - Settings", true, 32)
    
    if not shouldShow then
        GUI.showSettings = false
    end
    
    if open then
        local newMsgs, changedNewMsgs = ImGui.Checkbox(
            "Notify on new messages",
            Settings.settings.notifyNewMessages
        )
        if changedNewMsgs then
            Settings.settings.notifyNewMessages = newMsgs
            Settings.SaveSettings()
        end
        
        local userJoin, changedUserJoin = ImGui.Checkbox(
            "Notify on user join",
            Settings.settings.notifyUserJoin
        )
        if changedUserJoin then
            Settings.settings.notifyUserJoin = userJoin
            Settings.SaveSettings()
        end
        
        local userDisc, changedUserDisc = ImGui.Checkbox(
            "Notify on user disconnect",
            Settings.settings.notifyUserDisconnect
        )
        if changedUserDisc then
            Settings.settings.notifyUserDisconnect = userDisc
            Settings.SaveSettings()
        end
        
        local autoScroll, changedAutoScroll = ImGui.Checkbox(
            "Auto-Scroll chat",
            Settings.settings.autoScroll
        )
        if changedAutoScroll then
            Settings.settings.autoScroll = autoScroll
            Settings.SaveSettings()
        end
        
        local userList, changedUserList = ImGui.Checkbox(
            "Show User List",
            Settings.settings.showUserList
        )
        if changedUserList then
            Settings.settings.showUserList = userList
            Settings.SaveSettings()
        end
        

        
        local sound, changedSound = ImGui.Checkbox(
            "Enable notification sounds",
            Settings.settings.enableSound
        )
        if changedSound then
            Settings.settings.enableSound = sound
            Settings.SaveSettings()
        end
        ImGui.PushItemWidth(-1)
        local newDuration, durationChanged = ImGui.SliderInt("Notify duration (ms):", Settings.settings.toastDuration, 1000, 10000)
        ImGui.PopItemWidth()
        if durationChanged then
            Settings.settings.toastDuration = newDuration
            Settings.SaveSettings()
        end
        
        ImGui.End()
    end
end

function Settings.GetKeyName(keyCode)
    local keyNames = {
        [0x70] = "F1", [0x71] = "F2", [0x72] = "F3", [0x73] = "F4",
        [0x74] = "F5", [0x75] = "F6", [0x76] = "F7", [0x77] = "F8",
        [0x78] = "F9", [0x79] = "F10", [0x7A] = "F11", [0x7B] = "F12"
    }
    
    if keyNames[keyCode] then
        return keyNames[keyCode]
    else
        return string.format("0x%X", keyCode)
    end
end

function Settings.SetChatFeatureHash(hash)
    Settings.chatFeatureHash = hash
end

function Settings.ApplyHotkey()
    if Settings.chatFeatureHash then
        local currentHotkeys = HotKeyMgr.GetHotKeys(Settings.chatFeatureHash)
        
        for _, key in ipairs(currentHotkeys) do
            HotKeyMgr.RemoveHotkey(Settings.chatFeatureHash, key)
        end
        
        HotKeyMgr.AddHotkey(Settings.chatFeatureHash, Settings.settings.toggleHotkey)
    end
end

return Settings
