var sim;
var ticks;
var nodes = [];
var emptyChar = "&#183";
var flashEmptyChar = ":";
var flashInterval = 20;
var cannotPlaceChar = "x";
var nodeChar = "-";
var nodeWallChar = "=";
var nodeOutChar = "o";
var nodeInChar = "i";
var cursorChar = "&#164";
var connectCursorChar = "+";
var cursor;
var selectedPort = null;
var nextSet = [];
var pathfinding = false;
var paths = [];
var currPath = null;
var pathChar = "&#149";

/*
 ====================================================================================================
    STATES
 ====================================================================================================
*/

// State enums can be grouped as static members of a class
class STATE {
    // Create new instances of the same class as static attributes
    static SIMULATE = new STATE("SIMULATE");
    static PAUSED = new STATE("PAUSED");
    static PLACE = new STATE("PLACE");
    static INSPECT = new STATE("INSPECT");
    static CONNECT = new STATE("CONNECT");

    constructor(name) {
        this.name = name;
    }
}

/*
 ====================================================================================================
    LOOP
 ====================================================================================================
*/

async function RunLoop() {
    sim = new Simulation(50, 25, 50);
    ticks = 0;
    cursor = new Cursor();
    
    while (true) {
        if (sim.state != STATE.PAUSED) {
            if (sim.state == STATE.SIMULATE || sim.state == STATE.INSPECT)
                Evaluate();
            UpdateField();
            UpdateSpinner();
            ticks += 1;
            await new Promise(r => setTimeout(r, sim.updateInterval));
        }
        else
            await new Promise(r => setTimeout(r, sim.updateInterval));
    }
}

class Simulation {
    constructor(width, height, updateInterval) {
        this.width = width;
        this.height = height;
        this.updateInterval = updateInterval;
        this.state = STATE.SIMULATE;
        // construct grid
        this.grid = [];
        for (let j = 0; j < this.height; j++) {
            let newRow = [];
            for (let i = 0; i < this.width; i++) {
                newRow.push(new Point(i, j));
            }
            this.grid.push(newRow);
        }
    }
}

class Cursor {
    constructor() {
        this.pos = new Coord(0, 0);
    }
}

// calculates on set of nodes per frame
function Evaluate() {
    if (nextSet.length == 0) {                                      // if nextSet is empty, add all input nodes
        for (n of nodes) {
            if (n.constructor.name == "Input") {
                for (p of n.ports) {                                // all ports
                    for (c of p.connections) {                      // all connections
                        if (!nextSet.includes(c.node))              // add connected node if not already in nextSet
                            nextSet.push(c.node);
                    }
                }
            }
        }
    }
    
    let currSet = [...nextSet];                             // create copy of nextSet
    nextSet = [];                                           // clear nextSet
    for (n of currSet) {                                    // for every node of currSet
        let inputs = [];                                    // create list to put inputs
        for (p of n.ports) {                                // for every port of node
            if (p.char == nodeInChar) {                     // if it is an input port
                if (p.connections.length > 0) {             // if input is connected to something
                    let c = p.connections[0];               // get connection (should only be one connection to input)
                    inputs.push(c.node.out);                // add connection's node's output to our input list
                }
                else
                    inputs.push(0);                         // input port is 0 if not connected to anything
            }
            else {                                          // if it is an output port add its node to nextSet
                for (c of p.connections) {                  // for every connection
                    if (!nextSet.includes(c.node))
                        nextSet.push(c.node);               // add connected node to nextSet if not already there
                }
            }
        }
        n.Logic(inputs);                                    // do node logic
    }
}

function UpdateField() {
    // create temp grid that clones sim.grid
    let tempGrid = [];
    for (row of sim.grid) {
        let tempRow = [];
        for (point of row) {
            tempRow.push(point.char);
        }
        tempGrid.push(tempRow);
    }
    
    // render currPath
    if (pathfinding && currPath != null) {
        for (pos of currPath.positions) {
            tempGrid[pos.y][pos.x] = pathChar;
        }
    }
    
    // render all paths
    for (path of paths) {
        for (pos of path.positions) {
            tempGrid[pos.y][pos.x] = pathChar;
        }
    }
    
    switch(sim.state) {
        case STATE.SIMULATE:
            for (n of nodes) {
                if (n.constructor.name == "Output") {
                    // change grid to output
                    let x = n.pos.x + Math.floor(n.width / 2);
                    let y = n.pos.y + Math.floor(n.height / 2);
                    tempGrid[y][x] = n.charSets[n.charSet][n.out];
                }
            }
            break;
        case STATE.INSPECT:
            for (n of nodes) {
                if (n.constructor.name == "Output") {
                    // change grid to output
                    let x = n.pos.x + Math.floor(n.width / 2);
                    let y = n.pos.y + Math.floor(n.height / 2);
                    tempGrid[y][x] = n.charSets[n.charSet][n.out];
                }
            }
            tempGrid[cursor.pos.y][cursor.pos.x] = cursorChar;
            break;
        case STATE.PLACE:                                                       // add proposed node location to temp grid
            let currNode = nodes[nodes.length - 1];                             // most recent node
            for (let j = 0; j < currNode.height; j++) {                         // loop over node height
                let rowToChange = currNode.pos.y + j;                           // rows to change will be node pos.y + (0 to height-1)
                for (let i = 0; i < currNode.width; i++) {                      // loop over node width
                    let columnToChange = currNode.pos.x + i;                    // column to change will be node pos.x + (0 to width-1)
                    let nodeChar = currNode.shape[j][i];                        // char to put there
                    if (tempGrid[rowToChange][columnToChange] != emptyChar)     // if there is a node there, indicate w 'x'
                        tempGrid[rowToChange][columnToChange] = cannotPlaceChar;
                    else
                        tempGrid[rowToChange][columnToChange] = nodeChar;       // add to temp grid
                }
            }
            break;
        case STATE.CONNECT:
            // flash ports
            /*
            for (n of nodes) {
                for (p of n.ports) {
                    if (ticks % flashInterval < flashInterval / 2)
                        tempGrid[n.pos.y + p.pos.y][n.pos.x + p.pos.x] = nodeWallChar;
                }
            }
             */
            tempGrid[cursor.pos.y][cursor.pos.x] = connectCursorChar;
            break;
    }

    let gridText = "";
    let char = "";
    for (row of tempGrid) {
        for (point of row) {
            char = point;
            // flash empty points
            if (sim.state == STATE.PLACE) {
                if (ticks % flashInterval < flashInterval / 2 && char == emptyChar)
                    char = flashEmptyChar;
            }
            // add to text
            gridText += char + "&nbsp";
        }
        gridText += "\n";
    }

    // update field html
    let field = document.getElementById("field");
    field.innerHTML = gridText;
}

function UpdateSpinner()  {
    let spinner = document.getElementById("spinner");
    let spinChar = ">";
    switch(ticks % 4) {
        case 0:
            spinChar += "|";
            break;
        case 1:
            spinChar += "/";
            break;
        case 2:
            spinChar += "&mdash;";
            break;
        case 3:
            spinChar += "\\";
            break;
    }
    spinner.innerHTML = spinChar;
}

/*
 ====================================================================================================
    USER INPUT
 ====================================================================================================
*/

document.addEventListener('keydown', function(event) {
    switch (sim.state) {
        case (STATE.SIMULATE):
            switch (event.keyCode) {
                case 80: // p
                    SetState(STATE.PAUSED);
                    break;
                case 73: // i
                    SetState(STATE.INSPECT);
                    GetInfo();
                    break;
                case 67: // c
                    SetState(STATE.CONNECT);
                    break;
            }
            break;
        case (STATE.PAUSED):
            switch (event.keyCode) {
                case 80: // p
                    SetState(STATE.SIMULATE);
                    break;
                case 73: // i
                    Debug("Error: must be in simulation state to enter inspect mode")
                    break;
                case 67: // c
                    Debug("Error: cannot connect while in pause mode");
                    break;
            }
            break;
        case (STATE.PLACE):
            let currNode = nodes[nodes.length - 1];
            let xPos = currNode.pos.x;
            let yPos = currNode.pos.y;
            let width = currNode.width;
            let height = currNode.height;
            
            switch (event.keyCode) {
                case 65: // left
                    if (CanMove(xPos - 1, yPos, width, height))
                        currNode.pos.x -= 1;
                    break;
                case 68: // right
                    if (CanMove(xPos + 1, yPos, width, height))
                        currNode.pos.x += 1;
                    break;
                case 87: // up
                    if (CanMove(xPos, yPos - 1, width, height))
                        currNode.pos.y -= 1;
                    break;
                case 83: // down
                    if (CanMove(xPos, yPos + 1, width, height))
                        currNode.pos.y += 1;
                    break;
                case 13: // enter
                    PlaceNode();
                    break;
                case 8:  // del
                    CancelPlace();
                    break;
                case 80: // p
                    Debug("Error: cannot pause while in place mode")
                    break;
                case 73: // i
                    Debug("Error: cannot inspect while in place mode")
                    break;
                case 67: // c
                    Debug("Error: cannot connect while in place mode");
                    break;
            }
            cursor.pos.x = currNode.pos.x;
            cursor.pos.y = currNode.pos.y;
            break;
        case (STATE.INSPECT):
            switch (event.keyCode) {
                case 65: // left
                    if (cursor.pos.x > 0)
                        cursor.pos.x -= 1;
                    GetInfo();
                    break;
                case 68: // right
                    if (cursor.pos.x < sim.width - 1)
                        cursor.pos.x += 1;
                    GetInfo();
                    break;
                case 87: // up
                    if (cursor.pos.y > 0)
                        cursor.pos.y -= 1;
                    GetInfo();
                    break;
                case 83: // down
                    if (cursor.pos.y < sim.height - 1)
                        cursor.pos.y += 1;
                    GetInfo();
                    break;
                case 13: // enter
                    NodeAction();
                    break;
                case 8: // del
                    DeleteNode();
                    ClearInfoText();
                    break;
                case 82: // r
                    Rename();
                    break;
                case 77: // m
                    MoveNode();
                    ClearInfoText();
                    break;
                case 78: //n
                    DuplicateNode();
                    ClearInfoText();
                    break;
                case 80: // p
                    Debug("Error: cannot pause while in inspect mode")
                    break;
                case 73: // i
                    SetState(STATE.SIMULATE);
                    ClearInfoText();
                    break;
                case 67: // c
                    SetState(STATE.CONNECT);
                    ClearInfoText();
                    break;
            }
            break;
        case (STATE.CONNECT):
            switch (event.keyCode) {
                case 65: // left
                    if (cursor.pos.x > 0) {
                        cursor.pos.x -= 1;
                        Pathfind();
                    }
                    break;
                case 68: // right
                    if (cursor.pos.x < sim.width - 1) {
                        cursor.pos.x += 1;
                        Pathfind();
                    }
                    break;
                case 87: // up
                    if (cursor.pos.y > 0) {
                        cursor.pos.y -= 1;
                        Pathfind();
                    }
                    break;
                case 83: // down
                    if (cursor.pos.y < sim.height - 1) {
                        cursor.pos.y += 1;
                        Pathfind();
                    }
                    break;
                case 13: // enter
                    SelectPort();
                    break;
                case 8: // del
                    selectedPort = null;
                    currPath = null;
                    pathfinding = false;
                    break;
                case 80: // p
                    Debug("Error: cannot pause while in connect mode")
                    break;
                case 73: // i
                    SetState(STATE.INSPECT);
                    GetInfo();
                    break;
                case 67: // c
                    SetState(STATE.SIMULATE);
                    break;
            }
            break;
        
    }
});

// check if node is in bounds
function CanMove(x, y, w, h) {
    if (x < 0)
        return false;
    if (x + w - 1 >= sim.width)
        return false;
    if (y < 0)
        return false;
    if (y + h - 1 >= sim.height)
        return false;
    
    return true;
}

function PlaceNode() {
    let rowsToChange = [];
    let columnsToChange = [];
    let charsToPlace = [];
    
    // loop through first, checking if any point overlaps with another node
    // also add all points to the arrays
    let currNode = nodes[nodes.length - 1];                                 // most recent node
    for (let j = 0; j < currNode.height; j++) {                             // loop over node height
        let rowToChange = currNode.pos.y + j;                               // rows to change will be node pos.y + (0 to height-1)
        for (let i = 0; i < currNode.width; i++) {                          // loop over node width
            let columnToChange = currNode.pos.x + i;                        // column to change will be node pos.x + (0 to width-1)
            let nodeChar = currNode.shape[j][i];                            // char to put there
            if (sim.grid[rowToChange][columnToChange].char != emptyChar) {  // if there is a node there, cannot place
                Debug("Error: cannot place on top of other node");
                return;
            }
            else {
                rowsToChange.push(rowToChange);
                columnsToChange.push(columnToChange);
                charsToPlace.push(nodeChar);
            }
        }
    }
    
    // update grid
    for (let i = 0; i < charsToPlace.length; i++) {
        sim.grid[rowsToChange[i]][columnsToChange[i]].char = charsToPlace[i];
    }
    // exit place mode
    SetState(STATE.SIMULATE);
    
    Debug("Node placed");
}

function CancelPlace() {
    // remove added node from nodes
    nodes.pop();
    // exit place mode
    SetState(STATE.SIMULATE);
    
    Debug("Node Deleted");
}

// gets node that the cursor is hovering over
function GetNode() {
    // loop over all nodes to see what we're hovering over
    for (node of nodes) {
        // check x
        if (cursor.pos.x >= node.pos.x && cursor.pos.x < node.pos.x + node.width) {
            // check y
            if (cursor.pos.y >= node.pos.y && cursor.pos.y < node.pos.y + node.height) {
                // we are looking at this node
                return node;
            }
        }
    }
    return null;
}

function GetInfo() {
    let n = GetNode();
    let text = "";
    let info = document.getElementById("info");

    // cursor is not in a node
    if (n == null) {
        info.innerHTML = "";
        return;
    }
    
    // manual elements
    for (i of n.info) {
        text += i + ": " + n[i] + "\n";
    }
    // ports
    for (p of n.ports) {
        let connectionName = "";
        if (p.connections.length == 0)
            connectionName += "[none]";
        for (c of p.connections)
            connectionName += c.name + "[" + c.node.name + "] "
            
        text += p.name + ": " + connectionName + "\n";
    }

    info.innerHTML = text;
}

function ClearInfoText() {
    let info = document.getElementById("info");
    info.innerHTML = "";
}

function DeleteNode() {
    let n = GetNode();
    
    if (n == null) {
        Debug("Error no node to delete here");
        return;
    }
    
    // get index of node and remove it from array
    let index = nodes.indexOf(n);
    if (index > -1)
        nodes.splice(index, 1);
    else {
        Debug("Error cannot find node in nodes[]");
        return;
    }
    
    // remove from grid
    for (let j = 0; j < n.height; j++) {                            // loop over node height
        let rowToChange = n.pos.y + j;                              // rows to change will be node pos.y + (0 to height-1)
        for (let i = 0; i < n.width; i++) {                         // loop over node width
            let columnToChange = n.pos.x + i;                       // column to change will be node pos.x + (0 to width-1)
            sim.grid[rowToChange][columnToChange].char = emptyChar; // set that point to empty
        }
    }
    
    // remove paths from paths[]
    for (p of n.ports) {
        for (path of p.paths) {
            let i = paths.indexOf(path);
            if (i > -1)
                paths.splice(i, 1);
        }
    }

    // remove connections
    for (p of n.ports) {
        for (c of p.connections) {
            let i = c.connections.indexOf(p);
            if (i > -1) {
                c.connections.splice(i, 1);                 // remove connection from port
                c.pathIndices.splice(i, 1);                 // remove path from port indices
            }
        }
    }
    
    Debug("Node deleted");
}

function Rename() {
    let n = GetNode();
    
    if (n == null) {
        Debug("Error no node to rename here");
        return;
    }
    
    let newName = prompt("What will you rename this " + n.type + "?");
    if (newName == "")
        newName = n.type;
    n.SetName(newName);
    GetInfo(); // update info text
    
    // change grid
    let x = n.pos.x + Math.floor(n.width / 2);
    let y = n.pos.y + Math.floor(n.height / 2);
    sim.grid[y][x].char = n.name.substr(0,1);
}

function MoveNode() {
    let n = GetNode();
    if (n == null) {
        Debug("Error no node to move here");
        return;
    }
    
    let type = n.constructor.name;
    let nX = n.pos.x;
    let nY = n.pos.y;

    DeleteNode();   // delete node
    
    let newNode = CreateNode(type);
    nodes.push(newNode);  // re add it
    
    newNode.pos.x = nX;
    newNode.pos.y = nY;
    
    Debug("Moving node");
    SetState(STATE.PLACE);
}

function DuplicateNode() {
    let n = GetNode();
    if (n == null) {
        Debug("Error no node to move here");
        return;
    }
    
    let type = n.constructor.name;
    let nX = n.pos.x;
    let nY = n.pos.y;
    
    let newNode = CreateNode(type);
    nodes.push(newNode);  // re add it
    
    newNode.pos.x = nX;
    newNode.pos.y = nY;
    
    Debug("Duplicated node");
    SetState(STATE.PLACE);
}

// pressing enter over a node will execute a function specific to that node
function NodeAction() {
    let n = GetNode();
    
    if (n == null) {
        Debug("Error: no node to activate here");
        return;
    }
    
    n.Action();
    GetInfo();
}

function SelectPort() {
    let n = GetNode();
    
    if (n == null) {
        Debug("No port to select here");
        return;
    }
    
    // FIND PORT
    // compare node ports positions to cursor pos
    let currPort = null;
    for (port of n.ports) {
        let pX = n.pos.x + port.pos.x;
        let pY = n.pos.y + port.pos.y;
        if (pX == cursor.pos.x && pY == cursor.pos.y) {
            currPort = port;
            break;
        }
    }
    if (currPort == null) {
        Debug("No port to select here");
        return;
    }
    /*
    if (currPort.connection != null) {
        Debug("Port already connected");
        return;
    }
    */
    
    // LOGIC
    // set this as selectedPort or as target port
    if (selectedPort == null) {
        selectedPort = currPort;
        pathfinding = true;
        Debug("Port selected");
    }
    else {
        /*
        if (selectedPort.node == currPort.node) {
            Debug("Error: ports cannot be connected to other ports on the same node");
            return;
        }
         */
        if (selectedPort.char == currPort.char) {
            Debug("Error: ports cannot be of the same type");
            return;
        }
        pathfinding = false;
        
        // disconnect ports
        for (p1 of selectedPort.connections) {
            for (p2 of currPort.connections) {
                if (p1 == currPort && p2 == selectedPort) {
                    Debug("Connection removed between " + selectedPort.name + " and " + currPort.name);
                    // remove selectedPort connection:
                    let index = selectedPort.connections.indexOf(p1);
                    if (index > -1)
                        selectedPort.connections.splice(index, 1);
                    else {
                        Debug("Error removing connection from " + selectedPort.name);
                        return;
                    }
                    
                    let pathToRemove = null;
                    // remove path from selected port
                    for (let i = 0; i < selectedPort.paths.length; i++) {
                        let path = selectedPort.paths[i];
                        
                        let xI = selectedPort.pos.x + selectedPort.node.pos.x;
                        let yI = selectedPort.pos.y + selectedPort.node.pos.y;
                        let xF = currPort.pos.x + currPort.node.pos.x;
                        let yF = currPort.pos.y + currPort.node.pos.y;
                        
                        let pXF = path.positions[0].x;
                        let pYF = path.positions[0].y;
                        let pXI = path.positions[path.positions.length - 1].x;
                        let pYI = path.positions[path.positions.length - 1].y;
                        
                        // if the beginning and end positions of each path are equal
                        if (xI == pXI && yI == pYI) {
                            if (xF == pXF && yF == pYF) {
                                // this is the path
                                pathToRemove = path;
                                selectedPort.paths.splice(i, 1);
                                break;
                            }
                        }
                        else if (xI == pXF && yI == pYF) {
                            if (xF == pXI && yF == pYI) {
                                pathToRemove = path;
                                selectedPort.paths.splice(i, 1);
                                break;
                            }
                        }
                    }
                    
                    // remove currPort connection:
                    index = currPort.connections.indexOf(p2);
                    if (index > -1)
                        currPort.connections.splice(index, 1)
                    else {
                        Debug("Error removing connection from " + currPort.name);
                        return;
                    }
                    // remove path from currPort
                    if (pathToRemove == null) {
                        Debug("Error: cannot remove path");
                        return;
                    }
                    else {
                        let index = currPort.paths.indexOf(pathToRemove);
                        if (index > -1)
                            currPort.paths.splice(index, 1);
                    }
                    
                    // remove path from paths
                    index = paths.indexOf(pathToRemove);
                    if (index > -1)
                        paths.splice(pathToRemove, 1);
                    
                    selectedPort = null;
                    currPath = null;
                    
                    return;
                }
            }
        }
        // connect ports
        selectedPort.connections.push(currPort);
        currPort.connections.push(selectedPort);
        // add path
        paths.push(currPath);
        // add path to ports
        selectedPort.paths.push(currPath);
        currPort.paths.push(currPath);
        // selected port to null
        Debug("Connection made between " + selectedPort.name + " and " + currPort.name);
        selectedPort = null;
    }
}

function Pathfind() {
    if (!pathfinding)
        return;
    let c = sim.grid[cursor.pos.y][cursor.pos.x].char;
    if (c != emptyChar && c != nodeInChar && c != nodeOutChar)
        return;
    
    GetPathNeighbors();
    
    let posX = selectedPort.pos.x + selectedPort.node.pos.x;
    let posY = selectedPort.pos.y + selectedPort.node.pos.y;
    let start = sim.grid[posY][posX];
    
    let goal = sim.grid[cursor.pos.y][cursor.pos.x];
    
    currPath = CreatePath(start, goal);
}

/*
 ====================================================================================================
    NODES
 ====================================================================================================
*/

class Node {
    constructor(type, name, w, h) {
        this.type = type;
        this.pos = new Coord(0, 0);
        this.width = w;
        this.height = h;
        this.shape = [];
        this.InitShape();
        this.SetName(name);
        this.info = [];
        this.out = 0;
        this.ports = [];
    }
    InitShape() {
        for (let j = 0; j < this.height; j++) {
            let row = [];
            for (let i = 0; i < this.width; i++) {
                let char = nodeChar;
                if (i == 0 || i == this.width - 1)
                    char = nodeWallChar;
                else if (j == 0 || j == this.height - 1)
                    char = nodeWallChar;
                row.push(char);
            }
            this.shape.push(row);
        }
    }
    SetName(name) {
        let halfW = Math.floor(this.width / 2);
        let halfH = Math.floor(this.height / 2);
        this.shape[halfH][halfW] = name.substr(0, 1);
        this.name = name;
    }
    CreatePort(name, pos, char) {
        let p = new Port(name, pos, char, this);    // create port
        this.ports.push(p);                         // add it to ports[]
        this.shape[pos.y][pos.x] = char;            // add to shape
    }
    Action() { Debug("No action on this node"); }
    Logic(inputs) {}
}

class Input extends Node {
    constructor() {
        super("Input node", "I", 3, 3);
        this.info = ["type", "name", "out", "action"];
        this.action = "Toggle input on or off";
        this.CreatePort("outPort", new Coord(2, 1), nodeOutChar);
    }
    Action() { // toggle value
        // flip from 0 to 1 and vice versa
        this.out = 1 - this.out;
        Debug("Output value changed");
    }
}

class Output extends Node {
    constructor() {
        super("Output", "O", 3, 3);
        this.info = ["type", "name", "out", "action"];
        this.action = "Toggle char set";
        this.CreatePort("inPort", new Coord(0, 1), nodeInChar);
        this.CreatePort("outPort", new Coord(2, 1), nodeOutChar);
        this.charSets = [["0", "1"], ["&nbsp", "&#9632"]];
        this.charSet = 0;
    }
    Action() { // toggle char set
        this.charSet = (this.charSet + 1) % this.charSets.length;
    }
    Logic(inputs) {
        this.out = inputs[0];
    }
}

class And extends Node {
    constructor() {
        super("And gate", "A", 5, 5);
        this.info = ["type", "name", "out"];
        this.CreatePort("inPort1", new Coord(0, 1), nodeInChar);
        this.CreatePort("inPort2", new Coord(0, 3), nodeInChar);
        this.CreatePort("outPort", new Coord(4, 2), nodeOutChar);
    }
    Logic(inputs) {
        if (inputs[0] + inputs[1] == 2)
            this.out = 1;
        else
            this.out = 0;
    }
}

class Nand extends Node {
    constructor() {
        super("Nand gate", "n", 5, 5);
        this.info = ["type", "name", "out"];
        this.CreatePort("inPort1", new Coord(0, 1), nodeInChar);
        this.CreatePort("inPort2", new Coord(0, 3), nodeInChar);
        this.CreatePort("outPort", new Coord(4, 2), nodeOutChar);
    }
    Logic(inputs) {
        if (inputs[0] + inputs[1] == 2)
            this.out = 0;
        else
            this.out = 1;
    }
}

class Or extends Node {
    constructor() {
        super("Or gate", "O", 5, 5);
        this.info = ["type", "name", "out"];
        this.CreatePort("inPort1", new Coord(0, 1), nodeInChar);
        this.CreatePort("inPort2", new Coord(0, 3), nodeInChar);
        this.CreatePort("outPort", new Coord(4, 2), nodeOutChar);
    }
    Logic(inputs) {
        if (inputs[0] + inputs[1] > 0)
            this.out = 1;
        else
            this.out = 0;
    }
}

class Xor extends Node {
    constructor() {
        super("Xor gate", "X", 5, 5);
        this.info = ["type", "name", "out"];
        this.CreatePort("inPort1", new Coord(0, 1), nodeInChar);
        this.CreatePort("inPort2", new Coord(0, 3), nodeInChar);
        this.CreatePort("outPort", new Coord(4, 2), nodeOutChar);
    }
    Logic(inputs) {
        if (inputs[0] + inputs[1] == 1)
            this.out = 1;
        else
            this.out = 0;
    }
}

class Not extends Node {
    constructor() {
        super("Not gate", "N", 3, 3);
        this.info = ["type", "name", "out"];
        this.CreatePort("inPort", new Coord(0, 1), nodeInChar);
        this.CreatePort("outPort", new Coord(2, 1), nodeOutChar);
    }
    Logic(inputs) {
        this.out = 1 - inputs[0];
    }
}

/*
 ====================================================================================================
    MISC
 ====================================================================================================
*/

function AddNode() {
    ClearInfoText();
    
    // cannot add a new node while already placing one
    if (sim.state == STATE.PLACE) {
        Debug("Error: cannot add new node while in place mode");
        return;
    }
    
    // get node from selection thing
    let nodeName = document.getElementById("nodeSelect").value;
    // create node
    let newNode = CreateNode(nodeName);
    
    // add to array
    nodes.push(newNode);
    // set position
    if (cursor.pos.x + newNode.width > sim.width - 1) {
        newNode.pos.x = sim.width - newNode.width;
    }
    else
        newNode.pos.x = cursor.pos.x;
    if (cursor.pos.y + newNode.height > sim.height - 1) {
        newNode.pos.y = sim.height - newNode.height;
    }
    else
        newNode.pos.y = cursor.pos.y;
    
    SetState(STATE.PLACE);
    
    Debug("Placing new " + nodeName + " node");
}

function CreateNode(type) {
    switch (type) {
        case "Input":
            return new Input();
        case "Output":
            return new Output();
        case "And":
            return new And();
        case "Nand":
            return new Nand();
        case "Or":
            return new Or();
        case "Xor":
            return new Xor();
        case "Not":
            return new Not();
        default:
            return new Input();
    }
}

function Debug(text) {
    let debug = document.getElementById("debug");
    debug.innerHTML = text;
}

// replace nth index of string
function StringReplace(string, index, replacement) {
    return string.substr(0, index) + replacement + string.substr(index + replacement.length);
}

function SetState(state) {
    sim.state = state;
    
    let s = document.getElementById("state");
    s.innerHTML = state.name;
    
    // when we switch states, cancel connection process
    selectedPort = null;
    currPath = null;
    
}

class Coord {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

class Port {
    constructor(name, pos, char, node) {
        this.name = name;
        this.pos = pos;
        this.char = char;
        this.node = node;
        this.connections = [];
        this.paths = [];
    }
}

/*
 ====================================================================================================
    A*
 ====================================================================================================
*/

class Path {
    constructor(positions) {
        this.positions = positions;
    }
}

class Point {
    constructor(x, y) {
        this.char = emptyChar;
        this.neighbors = [];
        this.pos = new Coord(x, y);
        this.f = 0;
        this.g = 0;
        this.h = 0;
        this.prevNode = null;
    }
    Clear() {
        this.neighbors = [];
        this.f = 0;
        this.g = 0;
        this.h = 0;
        this.prevNode = null;
    }
}

function GetPathNeighbors() {
    for (let j = 0; j < sim.height; j++) {
        for (let i = 0; i < sim.width; i++) {
            let point = sim.grid[j][i];
            point.Clear();
            if (point.char != emptyChar && point.char != nodeInChar && point.char != nodeOutChar)
                continue;
            
            // add left and right neighbors
            if (i < sim.width - 1) {
                let c = sim.grid[j][i + 1].char;
                if (c == emptyChar || c == nodeInChar || c == nodeOutChar)
                    point.neighbors.push(sim.grid[j][i + 1]);
            }
            if (i > 0) {
                let c = sim.grid[j][i - 1].char;
                if (c == emptyChar || c == nodeInChar || c == nodeOutChar)
                    point.neighbors.push(sim.grid[j][i - 1]);
            }
            
            // add up and down neighbors
            if (j < sim.height - 1) {
                let c = sim.grid[j + 1][i].char;
                if (c == emptyChar || c == nodeInChar || c == nodeOutChar)
                    point.neighbors.push(sim.grid[j + 1][i]);
            }
            if (j > 0) {
                let c = sim.grid[j - 1][i].char;
                if (c == emptyChar || c == nodeInChar || c == nodeOutChar)
                    point.neighbors.push(sim.grid[j - 1][i]);
            }
        }
    }
}

function CreatePath(start, goal) {
    let openSet = [];
    let closedSet = [];
    
    openSet.push(start);
    
    while (openSet.length > 0) {
        let currNode = null;
        // currNode = node in open set with lowest fscore
        let maxF = Math.pow(10, 1000);
        for (n of openSet) {
            if (n.f < maxF) {
                currNode = n;
                maxF = n.f;
            }
        }
        if (currNode == null) {
            Debug("Error: cannot find path node with lowest f score");
            return;
        }
        
        // remove currNode from openset
        let index = openSet.indexOf(currNode);
        if (index > -1)
            openSet.splice(index, 1);
        else {
            Debug("Error cannot remove currNode from openSet");
            return;
        }
        
        // ad currNode to closedSet
        closedSet.push(currNode);
        
        if (currNode == goal) {
            // done!
            let positions = [currNode.pos];
            let prevNode = currNode.prevNode;
            while (prevNode != null) {
                let n = prevNode;
                positions.push(n.pos);
                prevNode = n.prevNode;
            }
            
            let newPath = new Path(positions);
            return newPath;
        }
        
        // loop over neighbors
        for (neighbor of currNode.neighbors) {
            // skip this neighbor if he is in closed set
            if (closedSet.includes(neighbor))
                continue;
            
            let distToCurr = Math.abs(currNode.pos.x - neighbor.pos.x) + Math.abs(currNode.pos.y - neighbor.pos.y);
            let g = currNode.g + distToCurr;
            
            let distToEnd = Math.abs(goal.pos.x - neighbor.pos.x) + Math.abs(goal.pos.y - neighbor.pos.y);
            let h = distToEnd;
            
            let f = neighbor.g + neighbor.h;
            
            if (g > neighbor.g) {
                neighbor.prevNode = currNode;
                neighbor.f = f;
                neighbor.g = g;
                neighbor.h = h;
                
                if (!openSet.includes(neighbor))
                    openSet.push(neighbor);
            }
        }
    }
    
    Debug("No path found");
    pathfinding = false;
    selectedPort = null;
    GetPathNeighbors();
    SetState(STATE.SIMULATE);
    return [];
}
