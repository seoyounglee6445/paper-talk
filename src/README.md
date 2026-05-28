#  Data for spatial transcriptomics on triple negative breast cancers
***

The repository contains a number of (tarballed) directories.

* ```byArray``` - data by array/subarray
* ```classification``` - data relative to the classification / regression at the spot level, as well as the
per-annotation gene expressions
* ```Clinical``` - clinical data and link array / samples
* ```clustering``` - data relative to the clusterings - by sample, the megaclusterings and the ecotypes
* ```deconvolution``` - gene expression in each annotation category, for each sample, obtained by deconvolution
* ```external datasets``` - external datasets used to confirm the results
* ```Images``` - original images (jpg, png...)
* ```misc``` - various annotation and other files
* ```patches``` - info about the patch size distribution
* ```rawCountsMatrices``` - raw count matrices
* ```Robjects``` - formatted R objects used for the analyses

***

## byArray
Data by array/subarray. Mapping between those arrays and samples is in ```ids.RDS```
(Clinical directory). 
In each directory, there are the following files -
* A ```Cy3``` jpg file giving the location of the spots
* An ```HE``` jpg file which is the H&E image
* For both image, there can be a ```.rot``` version if it was necessary to rotate them for the analysis.
* ```spot_data...``` give the localization of all or selected spots
* ```small.jpg``` is a subsampled version of the image.
* ```selection.RData``` counts of selected spots
* ```all.RData``` counts of all spots
* ```allSpots.RData``` position of all spots
* ```annotBySpot.RDS``` if available, the annotation (in pixel) for each spot
* ```artefacts.RDS``` if present, gives the number of pixels annotated as an artefact in each spot

***

## classification

Data relative to the classification / regression at the spot level.

* ```LOOstart.RData``` - Data with all the samples together used for the Xvalidation
* ```baseClassif.RDS``` - Rotation / scaling used on the gene-level data
* ```loosReg.RData``` - Result of the Xvalidation 
* ```classifAll.RDS``` - Classification of each spot

### projectedSamples
Data at the spot level projected on the PC from ```baseClassif.RDS```.

### regressors
The regressors obtained. Must be loaded with ```xgboost```. ```baseClassif.RDS``` is used
to rotate the genes prior to classification. See code for details, or use directly the
function ```classifySpots``` in the ```STstuff``` package.

***

## Clinical
Clinical data. 
* ```Clinical.xlsx``` - clinical data as an Excel table, identical to the one of paper
* ```Clinical.RDS``` - clinical data in R format (survival objects already created and slide-level
  annotation fractions included)
* ```ids.RDS``` - link between arrays and sample IDs

***

## clustering
Data relative to the clusterings - by sample, the megaclusterings and the ecotypes.

### intraPatientClust
Clusterings in each patient. Each RDS contains the following objects -
* `clusts` - the prototypes for the best clustering in 2 to 10 clusters
* `km` - the best kmeans for 2 to 10 clusters (cluster id for each spot)
* `qv` - quality of the clusterings
* `N` - number of clusters for each item / column in clusts / km.
* `scg` - score giving how spatial a gene is 

### clustPrototypes
Deconvolution of the best prototypes from intraPatientClust. List with the following items -
* `proto` - deconvoluted prototypes
* `fit` - the fitted model
* `kOrig` - the original kmeans
* `k` - the kmeans after removing some clusters (which we did not do)
* `Nreads` - total number of reads for the spot of each cluster

### Kmeans MC
Kmeans on the deconvoluted prototypes (megaclustering), in 5 to 20 clusters.

### looMC
Leave-one-out cross validation of the recovery of the MC in the bulk dataset.

### MC deconv
Deconvolution of the MC at the spot level. Each file contains the following objects -
* `m` - the fraction of each MC in each spot
* `idSpot` - the id of each spot (slide and position)
* `fm2` - the fitted model

***

## deconvolution
Per-annotation gene expressions used for TLS / tumor /stroma etc analyses.
Each file is an RData, containing -
* ```prot``` - the expression in each annotation, as pseudo-counts
* ```fm``` - the fitted models
* ```Ntot``` - the pseudo-number of spots corresponding to each annotation, obtained by
summing the fractional presence in each spot (e.g. 2 spots with 50% of annotation in each equal 
1 spot).

***

## external datasets
External datasets used to confirm the results.
* ```otherTNBC``` SCAN-B and METABRIC
* ```iSpy2``` Data from Ispy2
* Immunotherapies - directory with data for immunotherapies with expression data

***

## Images
The original images in png/jpg/ndpi format.

### imageAnnotation
Original annotation images. Coded as -
```
colAnn2 = c(Nothing="#FFFFFF", Tumor="#017801", Necrosis="#000000", `Fat tissue`="#000080",
  `Low TIL stroma`="#ff904f", Vessels="#dc0000", Artefacts="#6e2400",
  `Lactiferous duct`="#9980e6", `High TIL stroma`="#e9e900", `in situ`="#ccffcc",
  `Lymphoid nodule`="#80801a", `Hole (whitespace)`="#40e5f6", Lymphocyte="#c4417f",
  `Stroma cell`="#ff9980", Nerve="#4d8080", `Heterologous elements`="#808080",
  `Acellular stroma`="#e9d1bb", `Tumor region`="#258a15")
```

### imagesLarge
Original H&E images in high def, not rotated/translated.
The annotated image is not rotated either so those can be directly compared.

### imagesHD
Original H&E images in highest def. Similar to imagesLarge but bigger.

### artefacts
Contours from Qpath used to flag artefacts in non-annotated images. Correspond to imagesLarge.

***

## Images IHC
CD3/CD20 IHC images that were used to help slide annotation.
Note that those images are on a subsequent slide, and so do not correspond exactly to any of
the subarrays.

***

## misc

Various files that are used for image registration, deciding what to plot, annotations, etc.
The most useful ones are described here. For the others check the code (in particular ```ST TNBC figs.R``` for plotting).

### registration.xlsx
Transformations applied to superpose the images.
Columns:
pts: patient ID
fixed: ref slide
moving: the slide to transform
theta: rotation
dx, dy: translation
inv: if X, do a flip
In R, the transformation for the images are (using EBImage)
```
  if (!is.na(tr$inv)) { x = flip(dta[[i]]$im); spots[,"pixel_y"]=dim(x)[1]-spots[,"pixel_y"]; }
    x = rotate(x, tr$theta, filter='none', output.dim=dim(dta[[i]]$im)[1:2]+600, bg.col='white')
    x = translate(x, c(tr$dx, -tr$dy), bg.col='white')
    # The +600 is to have all the slide after rotation. It is removed below
```
Regarding the spot positions:
```
  spots[,c("pixel_x", "pixel_y")] = transfo(c(tr$theta*base::pi/180, tr$dx, -tr$dy),
      as.matrix(spots[,c("pixel_x", "pixel_y")]), ctr=dim(dta[[i]]$im)[1]/2)
```

The slides are then recentered to keep only the part with spots.

```
  sp = colRanges(do.call(rbind, lapply(dta, function(i) as.matrix(i$spots[,c("pixel_x", "pixel_y")]))));
  sp[,1] = sp[,1]-50; sp[,2]=sp[,2]+50;
  for (i in seq_along(dta))
  { x = translate(dta[[i]]$im, -sp[,1], bg.col='white');
    dta[[i]]$im = x[300+(0:diff(sp[1,])), 300+(1:diff(sp[2,])), ];
    dta[[i]]$spots[,c("pixel_x", "pixel_y")] = dta[[i]]$spots[,c("pixel_x", "pixel_y")] - rep(sp[,1], each=nrow(dta[[i]]$spots))
  }
```
***

## patches
Data on patch sizes distribution. Each ```RDS``` is a list, with items
* ```Np``` Number of pixels of each annotation (before dilatation)
* ```patches``` also a list, each item giving the size of each patch for each annotation.

***

## rawCountsMatrices
tsv files by array obtained directly from the sequencing.

***

## Robjects
R objects of the various basic data, used for the analyses.

### counts
Counts per gene per spot. Batch-corrected.
Lists with items:
cnts: matrix of counts
spots: ids of the spots (pixels are relative to the "images" files)

### countsNonCorrected
Similar to "counts", but not batch-corrected

### images
Lists with one item per slide (so 2-3 per sample)
For each slide there are two items:
img: image in EBImage format
spots: positions of the spots on that image

### imagesSmall
Same as images, but with smaller images. Usually big enough to display.
The "spots" info are rescaled to fit the image size.

### annotsBySpot
Lists with items:
* annots: matrix, N pixels annotated as class ... on each spot
* spots: position of the spots annotated

### annotationRecoded
Annotation images (imageAnnotation) recoded as a matrix of values 1 to 17.
The values correspond to the order of ```colAnn2``` (see imageAnnotation directory), so
* 1 = Nothing
* 2 = Tumor
* 3 = Necrosis
* and so on

***

There are also the following files -

### bulkCount.RDS
Counts per gene from the bulk RNA.

### PB_count.RDS
Counts per gene from the pseudo-bulk RNA (obtained by summing values from each spot for a alide).




