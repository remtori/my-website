(function check() {
	if (window.File && window.FileReader && window.FileList && window.Blob) {
		//alert('Great success! All the File APIs are supported.');	
	} else {
		alert('Trình duyệt của bạn quá cũ, xin hãy tải phiên bản mới hơn và thử lại !');
	}	
})()
var listImg = new Array();
function trigger() {
	document.getElementById('trigger').style.display='none';		
	RSname=document.getElementById("RSN").value;
	discription=document.getElementById("DCS").value;
	
	crop_resize();
}
var soluong = 0; //amount of files
var selected = 0; // 
var event_;
function save(event){
	event_=event;
	tmp = event.target.files.length;		
	soluong+=tmp;
	selected+=tmp;
	if (soluong==0) {
		document.getElementById('trigger').style.display='none';		
	}
	else{
		document.getElementById('trigger').style.display='block';
		if (soluong>64) {
			document.getElementById('warning').style.display='block';
		}
	}
	k=0;
	readfile();
}
var k=0;
var LL=0;
function readfile() {  
	if (k>=event_.target.files.length) {
		displayImg(); 
		document.getElementById('amout').innerHTML="Đã chọn "+selected+'/'+soluong+" ảnh !";
		return;
	}		
	document.getElementById('amout').innerHTML="Đang tải hình ("+(k+1)+"/"+event_.target.files.length+")";
	
	var selectedFile=event_.target.files[k];
	var reader = new FileReader();
	reader.onload = function(event_) {
		listImg[LL] = event_.target.result;
		LL++;
		readfile();
	}
	k++;	
	reader.readAsDataURL(selectedFile);	
}	

var dd = new Array();
function toggleImg(i) {	
	dd[i] = !dd[i];
	that=document.getElementById('imgID_'+i);
	if (dd[i]==true) {
		that.className="SI";
		selected++;
	} else {
		that.className="USI"
		selected--;
		}
	document.getElementById('amout').innerHTML="Đã chọn "+selected+'/'+soluong+" ảnh !";	
}
function displayImg(){
	
	function check(j) {
		if (!dd[j]) {
			return "U";
		}
		return "";
	}
	
	var tag='';
	for (j=0;j<listImg.length;j++) {		
		if (dd[j]==null) {dd[j] = true;}
		tag+='<button style="'+check(j)+'SI" id="imgID_'+j+'"onclick="toggleImg('+j+')">\
		<img src='+listImg[j]+' height="256">\
		</button>';	
	}
	document.getElementById("preview").innerHTML=tag;
}
// Converts canvas to an image
function Ctx2Img() {
	var image = new Image();
	var x = document.getElementById('myCanvas');
	image.src = x.toDataURL("image/png");
	return image;
}
var so=[16,32,64,128,256,512,768,1024,1280,1536,1792,2048];
var qq=0,kk=0;
var img = new Image();
function crop_resize() {		
	function cal(a,b) {
		return (a-b)/2;
	}
	if (qq>=listImg.length) {
		document.getElementById('amout').innerHTML="Tải lại trang để nếu muốn tiếp tục làm Resources Pack mới !";
		document.getElementById('download').style.display="block";
		// Output command ~ 
		document.getElementById('cmd').style.display="block";
		document.getElementById('cmd').value=CMD_output(selected);
		return;
	} 
	if (dd[qq]) {
		document.getElementById('amout').innerHTML="Đã xử lý ("+(kk+1)+'/'+selected+') ảnh !';
		// crop
		var c = document.getElementById('myCanvas');
		var ctx = c.getContext('2d');		
		img.src = listImg[qq];
		var h=img.height;
		var w=img.width;	
		var tg = Math.max(h,w); 
		document.getElementById("myCanvas").width=tg;
		document.getElementById("myCanvas").height=tg;
		ctx.drawImage(img, 0, 0, w, h, cal(tg,img.width), cal(tg,img.height), img.width, img.height);	
		if (consolelog) {console.log('After crop size H:'+c.height+' W:'+c.width);}
		// resize
		img=Ctx2Img();
		img.onload = function () {
			if (consolelog) {console.log('After convert size H:'+img.height+' W:'+img.width);}
			var m1=config_m1;	
			var gt=so[m1];	
			for (i=m1;i>=0;i--) {
				if (gt>Math.abs(so[i]-tg)){			
					gt=Math.abs(so[i]-tg);
					m1=i;
				}  
			}	
			if (consolelog) {console.log('Resize to:'+so[m1]);}
		
			document.getElementById("myCanvas").width=so[m1];
			document.getElementById("myCanvas").height=so[m1];	
	
			ctx.drawImage(img, 0, 0, so[m1], so[m1]);		
	
			data=document.getElementById("myCanvas").toDataURL('image/png').replace(/^data:image\/(png|jpg);base64,/, '');
				
			texture.file(kk+'.png',data, {base64: true});
			model.folder('image').file(kk+".json",_0_model+kk+_1_model);
			if (qq <= listImg.length -1 ) {
				kk++;
			}
			crop_resize();
		}
	}
	qq++;
}
//Zip file
var zip = new JSZip();
var model=zip.folder("assets").folder("minecraft").folder("models");
var texture=zip.folder("assets").folder("minecraft").folder("textures").folder("image");

	
function Output(){		
	zip.file("pack.mcmeta", pack_mcmeta+discription+pack_mcmeta1);
	// Write all model file ~
	base_model[3] = base_model[0] + mcVersion + base_model[1] + mcVersion + base_model[2];
	model.folder("image").file("base.json", base_model[3]);
	var tools_model;	
	var m = 0,i = 0,x1=0,x2=0;
	var dv = 0.1;
	var xx=0;		
	while (selected>0) {
		if (consolelog){console.log(selected)}
		m = Math.min(selected,item_durability[i]+1);
		tools_model=tool_model[0]+listTool[i]+tool_model[1];
		// round to 0.00001
		dv = (1/item_durability[i]);
		dv *=100000;
		dv = Math.round(dv);
		dv /=100000;		
		
		for (j=0;j<m-1;j++) {
			x1=j*dv;
			tools_model+=tool_model[5]+x1+tool_model[2]+x2+tool_model[3]+',';
			x2++;
		}
		// the last one doesn't have ","
		x1=(m-1)*dv;
		tools_model+=tool_model[5]+x1+tool_model[2]+x2+tool_model[3]+tool_model[4];
		x2++;selected-=m;
		model.folder("item").file(listTool[i]+'.json', tools_model);
		i++;
	}
	// Then Zip it
	zip.generateAsync({type:"blob"})
	.then(function(content) {
		saveAs(content, RSname+".zip")
	})
}
function toggleDisplayGuide() {
	b=document.getElementById('guide');
	c=b.style.display;
	if (c=='none') {
		b.style.display='block';
	}else {
		b.style.display='none';
	}
	if (!guide_frame_show) {
		document.getElementById('guide_frame').innerHTML='<iframe src="https://www.youtube.com/embed/0vlKNwgNusc" height="315" width="420"></iframe>';
		guide_frame_show = true;
	}
}
var guide_frame_show = false;
// ----------------------------------- Debugging/Cookie Option ------------------------------
var consolelog=false;
var RSname="Lê Quang Vũ";
var discription="§bby LQV";
var config_m1 = 5;
function res() {
	document.getElementById('warning').style.display='none';
	config_m1=document.getElementById('RSNS').value;	
}
// -----------------------------------DATA----------------------------------------------
var pack_mcmeta="\{\"pack\": {\"pack_format\": 2,\"description\":\"";
var pack_mcmeta1="\"}\}";
var base_model = [];
base_model[0]="\{\"elements\":\[\{\"from\":\[0,0,";
base_model[1]="\],\"to\":\[16,16,";
base_model[2]="\],\"faces\":\
\{\"south\":\{\"uv\":\[0,0,16,16\],\"texture\":\"#0\"\},\"west\":\{\"uv\":\[0,0,16,16\],\
\"texture\":\"#0\"\},\"north\":\{\"uv\":\[0,0,16,16\],\"texture\":\"#0\"\},\"east\":\{\"uv\
\":\[0,0,16,16\],\"texture\":\"#0\"\},\"up\":\{\"uv\":\[0,0,16,16\],\"texture\":\"#0\"\},\"down\
\":\{\"uv\":\[0,0,16,16\],\"texture\":\"#0\"\}\}\}\],\"display\":\{\"fixed\":\{\"rotation\":\[0,0,0\],\"translation\":\
\[0,0,0\],\"scale\":\[4,4,4\]\},\"gui\":\{\"rotation\":\[0,0,0\],\"translation\":\[0,0,0\],\"scale\":\[1,1,1\]\}\}\}";
var _0_model="\{\"__comment\": \"by LQV link: https://www.youtube.com/LQV99 or https://www.facebook.com/xLQVx \",\"parent\
\":\"image/base\",\"textures\":\{\"0\":\"image/";
var _1_model="\"\}\}";
var tool_model = [];
tool_model[0]="\{\"__comment\": \"by LQV link: https://www.youtube.com/LQV99 or https://www.facebook.com/xLQVx \",\"parent\
\":\"item/handheld\",\"textures\":\{\"layer0\":\"items/";
tool_model[1]="\"\},\"overrides\":\[";
tool_model[5]="\{\"predicate\":\{\"damage\":";
tool_model[2]="\},\"model\":\"image/";
tool_model[3]="\"\}";
// Remember to add ","
tool_model[4]="\]\}";
var listTool= ["golden_hoe","golden_axe","golden_shovel","golden_pickaxe","golden_sword","golden_chestplate","golden_boots","golden_leggings","golden_helmet"];
var item_durability=[32,32,32,32,32,113,92,106,78];
// --------------------------------------------------------------------------------------------
//										Command Combier
function CMD_output(n) {
	// Generate raw CMD 
	var cmd_base= [];
	cmd_base[0]="give @p chest 1 0 {display:{Name:\"Đặt xuống để lấy hình !\"},BlockEntityTag:{Items:[";
	cmd_base[1]="{Slot:";
	cmd_base[2]=",id:";
	cmd_base[3]=",Count:1,Damage:";
	cmd_base[4]="}";
	var cmd = [];
	var j=0;
	var k=0;
	var chest_slot=0;
	var damage_value=0;
	cmd[0]=cmd_base[0]
	for (i=0;i<n;i++) {
		cmd[k]+=cmd_base[1]+chest_slot+cmd_base[2]+listTool[j]+cmd_base[3]+damage_value+cmd_base[4];
		
		if (chest_slot < 27 && i < n-1) {cmd[k]+=',';} 
			else {
				cmd[k]+=']}}';
				if (i < n-1) {
					chest_slot=-1;			
					k++; 
					cmd[k]=cmd_base[0]
				}
			}
		
		if (item_durability[j]==damage_value) {j++;damage_value=-1;} 		
		
		chest_slot++;
		damage_value++;
	}
	// Combine time ! 
	if (cmd.length==1) {return cmd[0];} /* No need to compress 1 command :| */
	// Add backslash
	for (i=0;i<cmd.length;i++) {
		for (j=0;j<cmd[i].length;j++) {
			if (cmd[i][j]=='"') {
				insert(cmd[i], "\\", j);
			}			 
		}
	}
	var cmb_base = [];
	cmb_base[0]="summon FallingSand ~ ~1 ~ {Block:stone,Time:1,Passengers:[{id:FallingSand,Block:redstone_block,Time:1,Passengers:[{id:FallingSand,Block:activator_rail,Time:1,Passengers:[{";
	cmb_base[0]+="id:MinecartCommandBlock,Command:gamerule commandBlockOutput false}";
	cmb_base[1]=",{id:MinecartCommandBlock,Command:"
	cmb_base[2]="}"
	cmb_base[3]=",{id:MinecartCommandBlock,Command:setblock ~ ~ ~1 command_block 0 0 {Command:fill ~ ~-2 ~-1 ~ ~ ~ air}},{id:MinecartCommandBlock,Command:setblock ~ ~-1 ~1 redstone_block},{id:MinecartCommandBlock,Command:kill @e[type=MinecartCommandBlock,r=1]}]}]}]}";
	var res=cmb_base[0];
	for (i=0;i<cmd.length;i++) {
		res+=cmb_base[1]+cmd[i]+cmb_base[2];
	}
	res+=cmb_base[3];
	return res;
}
var mcVersion = "7.8";
function mcVer() {
	var a = document.getElementById("mcVer").value;
	if (a == 0) {
		mcVersion = "7.8";
	} else {
		mcVersion = "8.2";
	}
}
function insert(me, what, index) {
    return index > 0
        ? me.replace(new RegExp('.{' + index + '}'), '$&' + what)
        : what + me;
}