// Author: Chao Zhang (chao@bnl.gov)
// Oc 14, 2015

var MAX_EVENTS = 6;
var group, container, scene, camera, renderer, controls;
var helper_box, helper_cylinder;
var animationId;
var gui;
var listOfPCO = {};

var routes = {
    '/:eventId': Reload,
    '/:eventId/orthocamera': SetOrthoCamera
}

var options = {
    id: 0,
    orthocamera: false,
    depth: 8000,
    helper: {
        box: true,
        cylinder: false
    },
    material: {
        size: 0.8,
        opacity: 0.4
    },
    slice : {
        frame_mode: false,
        start: 0,
        width: 0.3
    },
    processes: [
        "Cerenkov",
        "Transportation",
        "Attenuation",
        "G4FastSimulationManagerProcess"
    ],
    showProcess: {
        Cerenkov: true,
        Transportation: true,
        Attenuation: true,
        G4FastSimulationManagerProcess: true
    }
};

function Reload(eventId) {
    options.id = parseInt(eventId);
    // console.log("id changed to " + id);
}

function SetOrthoCamera(eventId) {
    options.id = parseInt(eventId);
    options.orthocamera = true;
}

var router = Router(routes);
router.init();
// console.log(router);



// Point Cloud Object
var PCO = {
    init: function(name) {
        this.name = name;
        this.url = "data/" + options.id + "/" + options.id + "-" + name + ".json";
        this.setup();
    },

    setup: function() {
        var self = this;
        self.process = $.getJSON(self.url, function(data) {
            // console.log(data);
            self.initData(data);
            self.initPointCloud();
            console.log(self.url + " loaded");
        })
        .fail(function(){
            console.log("load " + self.url + " failed");
        });
        return self.process;
    },

    initData: function(data) {
        var self = this;
        self.x = [];
        self.y = [];
        self.z = [];
        self.t = [];

        var size = data.x.length; // all data must have x
        for (var i = 0; i < size; i++) {
            self.x.push(data.x[i]);
            self.y.push(data.y[i]);
            self.z.push(data.z[i]);
            self.t.push(data.t[i]);
        }
    },

    initPointCloud: function() {
        var self = this;

        // self.chargeColor = new THREE.Color(0xffffff);
        self.chargeColor = new THREE.Color(0x0000ff);
        if (self.name == "Cerenkov") {
            self.chargeColor = new THREE.Color(0xffff14); //yellow
        }
        else if (self.name == "Attenuation") {
            self.chargeColor = new THREE.Color(0xff0000); //red
        }
        else if (self.name == "G4FastSimulationManagerProcess") {
            self.chargeColor = new THREE.Color(0x00ff00); //green
        }
        self.material = new THREE.PointCloudMaterial({
            vertexColors    : true,
            size            : options.material.size,
            blending        : THREE.NormalBlending,
            opacity         : options.material.opacity,
            transparent     : true,
            depthWrite      : false,
            sizeAttenuation : false
        });

        self.drawAllTimeSlices();
    },

    drawInsideTimeSlice: function(start, width) {
        var self = this;
        var size = self.x.length;

        if (!(self.pointCloud == null)) {
            group.remove(self.pointCloud);
        }

        self.geometry = new THREE.Geometry();
        for (var i=0; i<size; i++) {
            var cutT = 5.1;
            var t = self.t[i]
            if (t  < start || t >= start+width ) continue;
            var x = self.x[i];
            var y = self.z[i]; // swap y and z
            var z = self.y[i];
            self.geometry.vertices.push(new THREE.Vector3(x, y, z));

            var color = self.chargeColor;
            self.geometry.colors.push(color);
        }
        self.pointCloud = new THREE.PointCloud(self.geometry, self.material);

        if (!(self.pointCloud == null)) {
            group.add(self.pointCloud);
        }

    },

    drawAllTimeSlices: function() {
        this.drawInsideTimeSlice( 0, 1e9 ); // everything in 1 sec.
    }

}

init();
animate();

function init() {
    // initGUI();
    var depth = options.depth;

    if (!options.orthocamera) {
        camera = new THREE.PerspectiveCamera( 25, window.innerWidth / window.innerHeight, 1, 40000 );

        camera.position.z = depth*Math.cos(Math.PI/3);
        camera.position.x = -depth*Math.sin(Math.PI/3);;
    }
    else {
        camera = new THREE.OrthographicCamera( window.innerWidth/-2, window.innerWidth/2, window.innerHeight/2, window.innerHeight/-2, 1, 4000 );
        camera.position.z = depth*Math.cos(Math.PI/4);
        camera.position.x = -depth*Math.sin(Math.PI/4);;
    }

    scene = new THREE.Scene();
    group = new THREE.Group();
    scene.add(group);

    var halfx=1200;
    var halfy=1200;
    var halfz=1200;
    helper_box = new THREE.BoxHelper( new THREE.Mesh( new THREE.BoxGeometry( halfx*2, halfy*2, halfz*2) ) );
    helper_box.material.color.setHex( 0x080808 );
    helper_box.material.blending = THREE.AdditiveBlending;
    helper_box.material.transparent = true;
    if (options.helper.box) { group.add( helper_box ); }

    var cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry( 500, 500, 1250, 32 ),
        new THREE.MeshBasicMaterial({
            color: 0xcccccc,
        })
    );
    helper_cylinder = new THREE.Object3D;
    var helper_c = new THREE.EdgesHelper( cylinder, 0x080808 );
    helper_c.material.blending = THREE.AdditiveBlending;
    helper_c.material.transparent = true;
    helper_cylinder.add(helper_c);
    helper_cylinder.position.y = 150;
    if (options.helper.cylinder) { group.add( helper_cylinder ); }

    for (var i in options.processes) {
        var pco = Object.create(PCO);
        var name = options.processes[i];
        pco.init(name);
        listOfPCO[name] = pco;
    }

    initGUI();

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth*0.85, window.innerHeight );
    renderer.gammaInput = true;
    renderer.gammaOutput = true;

    container = document.getElementById( 'container' );
    container.appendChild( renderer.domElement );

    controls = new THREE.OrbitControls( camera, renderer.domElement );
    window.addEventListener( 'resize', onWindowResize, false );
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth*0.85, window.innerHeight );
}

function animate() {

    // var time = Date.now() * 0.001;

    // if(doRotate) {
    //     rotate();
    // }
    // else {
    //     stop();
    // }
    // group.rotation.y = Date.now() * 0.0003;
    // camera.rotation.y = time * 0.01;

    animationId = requestAnimationFrame(animate);
    renderer.autoClear = false;
    renderer.clear();
    renderer.render( scene, camera );
}

function initGUI() {
    gui = new dat.GUI();

    var folder_general = gui.addFolder("General");
    folder_general.add(options, "id", 0, MAX_EVENTS-1)
       .name("Event")
       .step(1)
       .onFinishChange(function(value) {
            window.location.href = '#/' + value;
            window.location.reload();
        });
   folder_general.add(options.helper, "box")
       .name("Box helper")
       .onChange(function(value) {
           if (value) {
               group.add(helper_box);
           }
           else {
               group.remove(helper_box);
           }
       });
    folder_general.add(options.helper, "cylinder")
        .name("Tank helper")
        .onChange(function(value) {
            if (value) {
                group.add(helper_cylinder);
            }
            else {
                group.remove(helper_cylinder);
            }
        });
    folder_general.open();

    var folder_material = gui.addFolder("Material");
    folder_material.add(options.material, "size", 0.1, 4).step(0.1)
       .name("Size")
       .onChange(function(value) {
            for (var name in listOfPCO) {
                var pco = listOfPCO[name];
                pco.material.size = value;
                pco.material.needsUpdate = true;
            }
        });
    folder_material.add(options.material, "opacity", 0.1, 1).step(0.1)
       .name("Opacity")
       .onChange(function(value) {
            for (var name in listOfPCO) {
                var pco = listOfPCO[name];
                pco.material.opacity = value;
                pco.material.needsUpdate = true;
            }
        });
    folder_material.open();

    var folder_slice = gui.addFolder("Time Frames");
    folder_slice.add(options.slice, "frame_mode")
        .name("Frame mode")
        .onChange(function(value) {
            for (var name in listOfPCO) {
                var pco = listOfPCO[name];
                if(value) {
                    pco.drawInsideTimeSlice(options.slice.start, options.slice.width);
                    // console.log(options.slice.width)
                }
                else {
                    pco.drawAllTimeSlices();
                }
            }
        });
    folder_slice.add(options.slice, "width", 0.1, 2).step(0.1)
        .name("width [ns]")
        .onChange(function(value){
            ReDrawAllPCO();
        });
    folder_slice.add(options.slice, "start", 0.0, 10).step(0.1)
        .name("start [ns]")
        .onChange(function(value) {
            ReDrawAllPCO();
        });
    folder_slice.open();


    var folder_process = gui.addFolder("Processes");
    for (var i in options.processes) {
        var name = options.processes[i];
        folder_process.add(options.showProcess, name)
            .onChange(function(value) {
                var pco = listOfPCO[this.property];

                if(value) {
                    group.add(pco.pointCloud);
                }
                else {
                    group.remove(pco.pointCloud);
                }
                // console.log(pco);
            });
    }

    folder_process.open();

    $('.dg .property-name').css({
        'text-align': 'left'
    })
}

function ReDrawAllPCO() {
    if (options.slice.frame_mode) {
        for (var name in listOfPCO) {
            var pco = listOfPCO[name];
            pco.drawInsideTimeSlice(options.slice.start, options.slice.width);
        }
    }
}

function NextSlice() {
    if (options.slice.start >= 10) return;
    options.slice.start += 0.1;
    ReDrawAllPCO();
}

function PrevSlice() {
    if (options.slice.start <= 0) return;
    options.slice.start -= 0.1;
    ReDrawAllPCO();
}

$(document).on("keypress", function( event ) {
    if (event.which == 110 ) { // "n"
        // guiController.Next();
        // console.log(guiController.slice.position);
    }
    else if (event.which == 112 ) { // "p"
        // guiController.Prev();
    }
    else if (event.which == 107) { // "k"
        NextSlice();
    }
    else if (event.which == 106) { // "j"
        PrevSlice();
    }
    else {
        // console.log(event.which);
    }
});
