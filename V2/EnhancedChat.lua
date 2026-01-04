local menuRoot = FileMgr.GetMenuRootPath()
package.path = menuRoot .. "\\Lua\\?.lua;" ..
               menuRoot .. "\\Lua\\EnhancedChat\\?.lua;" ..
               package.path

local nativeSuccess, nativeError = pcall(function() 
    require("natives")
end)

if not nativeSuccess then
    print("EnhancedChat: Error loading Natives: " .. tostring(nativeError))
end

local Service = nil
local Settings = nil

local loadSuccess, loadError = pcall(function()
    Service = require("EnhancedChat.Service")
    GUI = require("EnhancedChat.GUI")
    Settings = require("EnhancedChat.Settings")
end)

if not loadSuccess then
    print("EnhancedChat: Error loading modules: " .. tostring(loadError))
    return
end

if Settings then
    Settings.LoadSettings()
end

if GUI and Service then
    GUI.SetService(Service)
    if Settings then
        GUI.SetSettings(Settings)
    end
end

local SCRIPT_NAME = "EnhancedChat"
local SCRIPT_VERSION = "2.0.0"
local scriptRunning = true
local lastVisibleState = false

local function OnPresent()
    if not scriptRunning or not GUI then
        return
    end
    
    pcall(function()
        lastVisibleState = GUI.isVisible
        
        GUI.Render()
        
        if Service then
            local currentSessionId = Service.GetSessionId()
            
            if GUI.sessionId and GUI.sessionId ~= currentSessionId then
                GUI.chatMessages = {}
                GUI.sessionId = currentSessionId
                
                Service.SendToServer(currentSessionId, Service.GetRockstarId())
                
                GUI.AddMessage("System", "Switched to new lobby")
            end
            
            local newMessages = Service.PollMessages()
            if newMessages then
                GUI.UpdateMessages(newMessages)
                
                if Settings and Settings.settings.notifyNewMessages then
                    for _, msg in ipairs(newMessages) do
                        if msg.showToast then
                            pcall(function()
                                GUI.ShowToast('', msg.sender .. ": " .. msg.message, Settings.settings.toastDuration)
                            end)
                        end
                    end
                end
            end
        end
    end)
end

local function OnScriptStop()
    scriptRunning = false

    if GUI then
        GUI.isVisible = false
        GUI.AddMessage("System", tostring(GUI.rockstarId) .. " left the chat")
    end
    
    pcall(function()
        if Service then
            local sessionId = Service.GetSessionId()
            local rockstarId = Service.GetRockstarId()

            local curl = Curl.Easy()
            local payload = string.format(
                '{"sessionId":"%s","rockstarId":"%s"}',
                tostring(sessionId or ""),
                tostring(rockstarId or "")
            )
            
            print("Disconnect Payload: " .. payload)
            
            curl:Setopt(eCurlOption.CURLOPT_URL, "http://localhost:3000/api/chat/disconnect")
            curl:Setopt(eCurlOption.CURLOPT_POST, 1)
            curl:Setopt(eCurlOption.CURLOPT_POSTFIELDS, payload)
            curl:AddHeader("Content-Type: application/json")
            
            curl:Perform()
        end
    end)
end

EventMgr.RegisterHandler(eLuaEvent.ON_PRESENT, OnPresent)
EventMgr.RegisterHandler(eLuaEvent.ON_SCRIPT_STOP, OnScriptStop)

local chatToggleFeature = FeatureMgr.AddFeature(
    Utils.Joaat("ENHANCED_CHAT_TOGGLE"),
    "Enhanced Chat",
    eFeatureType.Toggle,
    "Show or hide the chat window",
    function(f)
        if GUI then
            GUI.isVisible = f:IsToggled()
        end
    end
)

if GUI then
    GUI.chatToggleFeature = chatToggleFeature
end

chatToggleFeature:SetDefaultValue(true)
chatToggleFeature:SetSaveable(true)
chatToggleFeature:Reset()

if Settings then
    Settings.SetChatFeatureHash(Utils.Joaat("ENHANCED_CHAT_TOGGLE"))
    Settings.ApplyHotkey()
end

print(SCRIPT_NAME .. " v" .. SCRIPT_VERSION .. " loaded")
